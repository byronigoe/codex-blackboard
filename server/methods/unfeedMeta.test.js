// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("unfeedMeta", function () {
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
    Puzzles.insert({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy", "leaf"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    Puzzles.insert({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["meta"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    chai.assert.throws(
      () => Meteor.call("feedMeta", "leaf", "meta"),
      Match.Error
    );
  });

  it("removes when feeding", function () {
    Puzzles.insert({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy", "leaf"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    Puzzles.insert({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew", "meta"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    callAs("unfeedMeta", "jeff", "leaf", "meta");
    chai.assert.deepInclude(Puzzles.findOne("meta"), {
      puzzles: ["yoy"],
      touched: 7,
      touched_by: "jeff",
    });
    chai.assert.deepInclude(Puzzles.findOne("leaf"), {
      feedsInto: ["wew"],
      touched: 7,
      touched_by: "jeff",
    });
  });

  it("no-op when not feeding", function () {
    Puzzles.insert({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy"],
      feedsInto: [],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    Puzzles.insert({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    callAs("unfeedMeta", "jeff", "leaf", "meta");
    chai.assert.deepInclude(Puzzles.findOne("meta"), {
      puzzles: ["yoy"],
      touched: 1,
      touched_by: "torgen",
    });
    chai.assert.deepInclude(Puzzles.findOne("leaf"), {
      feedsInto: ["wew"],
      touched: 2,
      touched_by: "cjb",
    });
  });

  it("requires meta", function () {
    Puzzles.insert({
      _id: "leaf",
      name: "Bar",
      canon: "bar",
      created: 2,
      created_by: "cjb",
      touched: 2,
      touched_by: "cjb",
      feedsInto: ["wew"],
      link: "https://puzzlehunt.mit.edu/bar",
      tags: {},
    });
    chai.assert.throws(
      () => callAs("unfeedMeta", "jeff", "leaf", "meta"),
      Meteor.Error
    );
    chai.assert.deepEqual(Puzzles.findOne("leaf").feedsInto, ["wew"]);
  });

  it("requires leaf", function () {
    Puzzles.insert({
      _id: "meta",
      name: "Foo",
      canon: "foo",
      created: 1,
      created_by: "torgen",
      touched: 1,
      touched_by: "torgen",
      puzzles: ["yoy"],
      link: "https://puzzlehunt.mit.edu/foo",
      tags: {},
    });
    chai.assert.throws(
      () => callAs("feedMeta", "jeff", "leaf", "meta"),
      Meteor.Error
    );
    chai.assert.deepEqual(Puzzles.findOne("meta").puzzles, ["yoy"]);
  });
});
