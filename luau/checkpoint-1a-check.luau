--!strict
-- Cross-language engine gate: run the checkpoint_1a scenario through the Luau
-- engine twin and assert byte-parity with the JS golden (test/fixtures/
-- checkpoint_1a.json). Run from repo root: `lune run luau/checkpoint-1a-check.luau`.

local fs = require("@lune/fs")
local serde = require("@lune/serde")
local process = require("@lune/process")

local road = require("./road_data")
local car = require("./car_data")
local traffic = require("./traffic_data")
local scenario = require("./scenario")

local function read(p)
	return serde.decode("json", fs.readFile(p))
end

local ctx = {
	courseSet = road.loadCourseSet(read("data/roads.json")),
	carSet = car.loadCarSet(read("data/cars.json")),
	trafficConfig = traffic.loadTrafficConfig(read("data/traffic.json")),
}
local fixture = read("test/fixtures/checkpoint_1a.json")
local r = scenario.runScenario(fixture.scenario, ctx)

local failures = {}
for _, t in ipairs(fixture.scenario.hashTicks) do
	local want = fixture.expected.hashes[tostring(t)]
	if r.hashes[t] ~= want then
		table.insert(failures, string.format("hash@%d got %s want %s", t, tostring(r.hashes[t]), tostring(want)))
	end
end
if r.finalHash ~= fixture.expected.finalHash then
	table.insert(failures, "finalHash " .. tostring(r.finalHash) .. " != " .. tostring(fixture.expected.finalHash))
end

local wantCensus = fixture.expected.census
if #r.census ~= #wantCensus then
	table.insert(failures, "census length " .. #r.census .. " != " .. #wantCensus)
else
	for i, e in ipairs(r.census) do
		if e.type ~= wantCensus[i].type or e.tick ~= wantCensus[i].tick then
			table.insert(failures, "census[" .. i .. "] mismatch")
		end
	end
end

if #failures > 0 then
	print("LUAU ENGINE PARITY FAIL:")
	for _, f in ipairs(failures) do
		print("  " .. f)
	end
	process.exit(1)
end

print("LUAU ENGINE PARITY OK — checkpoint_1a matches JS (" .. r.finalHash .. ")")
