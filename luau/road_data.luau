--!strict
-- Luau twin of shared/road_data.js — course/segment indexing + routing.
-- Twin scope: build indexes and route; the JS side owns validation (the twin's
-- job is byte-parity on runnable data). Arrays come 1-indexed from serde.
-- EXPORTS: loadCourseSet(json), getCourse(cs, id), getSegment(cs, id),
-- nextSegment(cs, id, choice).

local function loadCourseSet(json)
	local segmentsById = {}
	for _, seg in ipairs(json.segments) do
		segmentsById[seg.id] = seg
	end
	local coursesById = {}
	for _, c in ipairs(json.courses) do
		coursesById[c.id] = c
	end
	return {
		courses = json.courses,
		segments = json.segments,
		segmentsById = segmentsById,
		coursesById = coursesById,
	}
end

local function getCourse(cs, id)
	return cs.coursesById[id]
end

local function getSegment(cs, id)
	return cs.segmentsById[id]
end

local function nextSegment(cs, id, choice: number): number
	local seg = cs.segmentsById[id]
	if seg.forkLeft < 0 and seg.forkRight < 0 then
		return seg.next
	end
	if choice == 1 then
		return seg.forkRight
	end
	return seg.forkLeft
end

return {
	loadCourseSet = loadCourseSet,
	getCourse = getCourse,
	getSegment = getSegment,
	nextSegment = nextSegment,
}
