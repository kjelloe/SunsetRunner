--!strict
-- Sunset Runner — authoritative server (marker-0098). Runs the SAME deterministic
-- reducer as the browser/lune twin (ReplicatedStorage.Shared) at 20 Hz, one solo
-- race per player (seat 1, course 4 grand_tour with traffic + boost pads + forks),
-- and streams a per-seat view to each client. No gameplay logic lives here — this
-- is only the host: seed, tick, replicate. Mirrors server/index.js + game_room.js.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local RS = game:GetService("ReplicatedStorage")

-- Camera-only racer: no avatars. The car is a rendered Part, not a character.
Players.CharacterAutoLoads = false

local Shared = RS:WaitForChild("Shared")
local GameData = RS:WaitForChild("GameData")

local road = require(Shared.road_data)
local carData = require(Shared.car_data)
local trafficData = require(Shared.traffic_data)
local stateMod = require(Shared.state)
local reducer = require(Shared.reducer)

local courseSet = road.loadCourseSet(require(GameData.roads))
local carSet = carData.loadCarSet(require(GameData.cars))
local trafficConfig = trafficData.loadTrafficConfig(require(GameData.traffic))
local ctx = { courseSet = courseSet, carSet = carSet, trafficConfig = trafficConfig }

local COURSE_ID = 4
local START_TIME_TICKS = 3000
local TICK_DT = 1 / 20

-- Two channels: intents in, per-seat views out.
local inputEvent = Instance.new("RemoteEvent")
inputEvent.Name = "SunsetInput"
inputEvent.Parent = RS
local viewEvent = Instance.new("RemoteEvent")
viewEvent.Name = "SunsetView"
viewEvent.Parent = RS

type Session = { state: any, input: { steer: number, accel: number, brake: number }, fork: number, seed: number }
local sessions: { [Player]: Session } = {}

local function freshState(seed: number)
	return stateMod.createInitialState({
		seed = seed,
		courseSet = courseSet,
		carSet = carSet,
		courseId = COURSE_ID,
		seats = { { id = 1, carId = 1 } },
		startTimeTicks = START_TIME_TICKS,
		trafficConfig = trafficConfig,
	})
end

local function startSession(player: Player)
	local seed = 12345 + (player.UserId % 100000)
	sessions[player] = { state = freshState(seed), input = { steer = 0, accel = 0, brake = 0 }, fork = 0, seed = seed }
end

-- The slice of state a client needs to render: self seat + same-segment traffic.
local function buildView(state)
	local s = state.seats[1]
	local traffic = {}
	for _, t in ipairs(state.traffic) do
		if t.segmentId == s.segmentId and t.roadZ >= s.roadZ then
			table.insert(traffic, { roadZ = t.roadZ, laneX = t.laneX, kind = t.kind })
		end
	end
	return {
		tick = state.tick,
		seat = {
			segmentId = s.segmentId,
			roadZ = s.roadZ,
			laneX = s.laneX,
			speed = s.speed,
			boostTicks = s.boostTicks,
			timerTicks = s.timerTicks,
			finishTicks = s.finishTicks,
			timedOut = s.timedOut,
			crashedTicks = s.crashedTicks,
			forkChoice = s.forkChoice,
		},
		traffic = traffic,
	}
end

inputEvent.OnServerEvent:Connect(function(player, msg)
	local sess = sessions[player]
	if not sess or typeof(msg) ~= "table" then
		return
	end
	-- Clamp to the same range the JS protocol enforces (analog steer magnitude).
	local steer = math.clamp(tonumber(msg.steer) or 0, -256, 256)
	sess.input = { steer = steer, accel = (msg.accel == 1) and 1 or 0, brake = (msg.brake == 1) and 1 or 0 }
	if msg.fork == -1 or msg.fork == 1 then
		sess.fork = msg.fork
	end
end)

Players.PlayerAdded:Connect(startSession)
Players.PlayerRemoving:Connect(function(player)
	sessions[player] = nil
end)
for _, p in ipairs(Players:GetPlayers()) do -- players already present (Studio Play)
	startSession(p)
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += math.min(dt, 0.25) -- clamp so a hitch can't fast-forward the race
	while acc >= TICK_DT do
		acc -= TICK_DT
		for player, sess in pairs(sessions) do
			local st = sess.state
			local seat = st.seats[1]
			-- Finished or timed out: loop into a fresh race (no framing yet, v1).
			if seat.finishTicks >= 0 or seat.timedOut ~= 0 then
				sess.seed += 1
				sess.state = freshState(sess.seed)
			else
				st = reducer.apply(st, { type = "input", seatId = 1, steer = sess.input.steer, accel = sess.input.accel, brake = sess.input.brake }, ctx)
				if sess.fork ~= 0 then
					st = reducer.apply(st, { type = "forkChoice", seatId = 1, choice = sess.fork }, ctx)
					sess.fork = 0
				end
				st = reducer.apply(st, { type = "advance_tick" }, ctx)
				sess.state = st
			end
		end
	end
	for player, sess in pairs(sessions) do
		viewEvent:FireClient(player, buildView(sess.state))
	end
end)
