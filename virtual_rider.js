let atStopState = (id) => `at_stop:${id}`;
let onTripState = (id) => `on_trip:${id}`;

let MAX_TIME = 1000 * 60;

class StateMap {
  constructor() {
    this.earliestRidersAtStates = {};
  }

  addRider(rider) {
    let existing = this.earliestRidersAtStates[rider.state];
    if (!existing || rider.time < existing.time) {
      this.earliestRidersAtStates[rider.state] = rider;
      return true;
    }
    return false;
  }

  addRiderAndTransfersByAppendingStop(oldRider, stopId, time, allTransfers) {
    let direct = oldRider.byAdding(atStopState(stopId), time);
    if (this.addRider(direct)) {
      // add all transfers:
      for (let transfer of allTransfers[stopId] || []) {
        this.addRiderAndTransfersByAppendingStop(direct, transfer.to, time + transfer.time, allTransfers);
      }
    }
  }
}

class Rider {
  constructor(states, time) {
    this.states = states; // states are strings
    this.time = time;
    this.state = states.length ? states[states.length - 1] : null;
  }

  byAdding(state, finalTime) {
    return new Rider([...this.states, state], finalTime);
  }
}

let scheduleCache = {};
let getSchedule = (name, callback) => {
  if (scheduleCache[name]) {
    callback(scheduleCache[name]);
  } else {
    d3.json(`/schedules/${name}.json`, (schedule) => {
      scheduleCache[name] = schedule;
      callback(schedule);
    })
  }
}
let computeTravelTimes = (startStationId, scheduleName, callback) => {
  getSchedule(scheduleName, ({events, start_time: startTime}) => {
    const endStationIds = Object.keys(subway.stations)
    const transfers = gtfs_transfers
    let stateMap = new StateMap();

    let emptyPath = new Rider([], startTime);
    stateMap.addRiderAndTransfersByAppendingStop(emptyPath, startStationId, startTime, transfers);
    // console.log(stateMap);

    for (let {time, trip_id, stop_id} of events) {
      // model exiting the train:
      let riderOnTrain = stateMap.earliestRidersAtStates[onTripState(trip_id)];
      if (riderOnTrain && riderOnTrain.time <= time) {
        stateMap.addRiderAndTransfersByAppendingStop(riderOnTrain, stop_id, time, transfers);
      }
      // model boarding the train:
      let riderOnPlatform = stateMap.earliestRidersAtStates[atStopState(stop_id)];
      if (riderOnPlatform && riderOnPlatform.time <= time) {
        let riderOnTrain = riderOnPlatform.byAdding(onTripState(trip_id), time);
        stateMap.addRider(riderOnTrain);
      }
    }

    let travelTimes = {};
    for (let stationId of endStationIds) {
      let rider = stateMap.earliestRidersAtStates[atStopState(stationId)];
      travelTimes[stationId] = rider ? rider.time - startTime : MAX_TIME;
    }
    callback(travelTimes);
  });
};
