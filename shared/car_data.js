// shared/car_data.js — car roster loading + validation.
// Pure, parse-at-edge (takes already-parsed JSON), integer-only — same
// discipline as road_data.js. Car stats drive feel; they live in data, never
// in code (brief §13). Luau-portable.

function assertInt(v, label) {
  if (!Number.isInteger(v)) throw new TypeError(`${label} must be an integer: ${v}`);
  return v;
}

const CAR_STAT_FIELDS = [
  "maxSpeed", "accel", "brake", "offroadDrag", "steerLow", "steerHigh", "driftRecovery",
];

export function loadCarSet(json) {
  if (!json || !Array.isArray(json.cars)) {
    throw new TypeError("car data must have an array: cars");
  }
  const carsById = new Map();
  for (const car of json.cars) {
    assertInt(car.id, "car.id");
    if (car.id <= 0) throw new RangeError(`car.id must be positive: ${car.id}`);
    if (carsById.has(car.id)) throw new RangeError(`duplicate car.id: ${car.id}`);
    if (typeof car.nameKey !== "string") throw new TypeError(`car ${car.id} nameKey must be a string`);
    for (const f of CAR_STAT_FIELDS) {
      if (assertInt(car[f], `car.${f}`) < 0) throw new RangeError(`car ${car.id} ${f} must be >= 0`);
    }
    if (car.maxSpeed <= 0) throw new RangeError(`car ${car.id} maxSpeed must be positive`);
    carsById.set(car.id, car);
  }
  return { cars: json.cars, carsById };
}

export function getCar(carSet, carId) {
  const car = carSet.carsById.get(carId);
  if (!car) throw new RangeError(`unknown car: ${carId}`);
  return car;
}
