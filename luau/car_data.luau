--!strict
-- Luau twin of shared/car_data.js — car roster indexing.
-- EXPORTS: loadCarSet(json), getCar(cs, id).

local function loadCarSet(json)
	local carsById = {}
	for _, car in ipairs(json.cars) do
		carsById[car.id] = car
	end
	return { cars = json.cars, carsById = carsById }
end

local function getCar(cs, id)
	return cs.carsById[id]
end

return { loadCarSet = loadCarSet, getCar = getCar }
