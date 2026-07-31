--!strict
-- Luau twin of shared/traffic_data.js — traffic config indexing.
-- EXPORTS: loadTrafficConfig(json).

local function loadTrafficConfig(json)
	local kindsById = {}
	for _, k in ipairs(json.kinds) do
		kindsById[k.id] = k
	end
	return {
		density = json.density,
		lanes = json.lanes,
		kinds = json.kinds,
		kindsById = kindsById,
	}
end

return { loadTrafficConfig = loadTrafficConfig }
