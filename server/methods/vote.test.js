// For side effects
import "/lib/model.js";
import { Polls } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("vote", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(() => resetDatabase());

  it("fails without login", function () {
    Polls.insert({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {},
    });
    chai.assert.throws(() => Meteor.call("vote", "foo", "foo"), Match.Error);
  });

  it("fails with missing poll", () =>
    chai.assert.throws(() => callAs("vote", "torgen", "", "foo"), Match.Error));

  it("fails with missing option", () =>
    chai.assert.throws(() => callAs("vote", "torgen", "foo"), Match.Error));

  it("no-ops when no such poll", function () {
    callAs("vote", "torgen", "foo", "bar");
    chai.assert.notExists(Polls.findOne());
  });

  it("no-ops when no such option", function () {
    Polls.insert({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    callAs("vote", "torgen", "foo", "qux");
    chai.assert.deepEqual(Polls.findOne(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
  });

  it("adds vote", function () {
    Polls.insert({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    callAs("vote", "torgen", "foo", "bar");
    chai.assert.deepEqual(Polls.findOne(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {
        metasj: { canon: "foo", timestamp: 4 },
        torgen: { canon: "bar", timestamp: 7 },
      },
    });
  });

  it("changes vote", function () {
    Polls.insert({
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: { metasj: { canon: "foo", timestamp: 4 } },
    });
    callAs("vote", "metasj", "foo", "bar");
    chai.assert.deepEqual(Polls.findOne(), {
      _id: "foo",
      options: [
        { canon: "foo", option: "Foo" },
        { canon: "bar", option: "Bar" },
      ],
      created: 2,
      created_by: "cscott",
      votes: {
        metasj: { canon: "bar", timestamp: 7 },
      },
    });
  });
});
