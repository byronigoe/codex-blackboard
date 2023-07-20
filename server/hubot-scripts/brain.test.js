import script, { brain } from "./brain.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import Robot from "../imports/hubot.js";
import { waitForDocument } from "/lib/imports/testutils.js";
import delay from "delay";

describe("brain hubot script", function () {
  let robot = null;
  let clock = null;

  beforeEach(function () {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 7,
      toFake: ["Date", "setInterval", "clearInterval"],
    });
    // can't use plain hubot because this script uses priv, which isn't part of
    // the standard message class or adapter.
    robot = new Robot("testbot", "testbot@testbot.test");
  });

  afterEach(function () {
    robot.shutdown();
    clock.restore();
  });

  it("loads data", function () {
    brain.insert({
      _id: "ambushes",
      value: {
        torgen: ["hi"],
        cjb: ["yo", "wazzup?"],
      },
    });
    brain.insert({
      _id: "drinks",
      value: 3,
    });
    script(robot);
    robot.run();
    chai.assert.deepInclude(robot.brain.data, {
      ambushes: {
        torgen: ["hi"],
        cjb: ["yo", "wazzup?"],
      },
      drinks: 3,
    });
  });

  it("saves data", function () {
    script(robot);
    robot.run();
    robot.brain.data.ambushes = {
      torgen: ["hi"],
      cjb: ["yo", "wazzup?"],
    };
    robot.brain.data.drinks = 3;
    clock.tick(5000);
    const ambushes = waitForDocument(
      brain,
      { _id: "ambushes" },
      {
        value: {
          torgen: ["hi"],
          cjb: ["yo", "wazzup?"],
        },
      }
    );
    const drinks = waitForDocument(brain, { _id: "drinks" }, { value: 3 });
    return Promise.all([ambushes, drinks]);
  });

  it("syncs users", async function () {
    Meteor.users.insert({
      _id: "torgen",
    });
    script(robot);
    robot.run();
    chai.assert.deepInclude(robot.brain.data.users.torgen, { name: "torgen" });
    Meteor.users.update("torgen", { $set: { nickname: "Torgen" } });
    await delay(200);
    chai.assert.deepInclude(robot.brain.data.users.torgen, { name: "Torgen" });
    Meteor.users.update("torgen", { $set: { real_name: "Dan Rosart" } });
    await delay(200);
    chai.assert.deepInclude(robot.brain.data.users.torgen, {
      name: "Dan Rosart",
    });
  });
});
