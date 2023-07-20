// For side effects
import "/lib/model.js";
import { Messages, Rounds } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("renameRound", function () {
  let clock = null;
  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(function () {
    clock.restore();
    sinon.restore();
  });

  beforeEach(() => resetDatabase());

  describe("when new name is unique", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Rounds.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "torgen",
          touched: 1,
          touched_by: "torgen",
          puzzles: ["yoy"],
          link: "https://puzzlehunt.mit.edu/foo",
          tags: {},
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(
        () =>
          Meteor.call("renameRound", {
            id,
            name: "Bar",
          }),
        Match.Error
      ));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(
        () =>
          (ret = callAs("renameRound", "cjb", {
            id,
            name: "Bar",
          }))
      );

      it("returns true", () => chai.assert.isTrue(ret));

      it("renames round", function () {
        const round = Rounds.findOne(id);
        chai.assert.include(round, {
          name: "Bar",
          canon: "bar",
          touched: 7,
          touched_by: "cjb",
        });
      });

      it("oplogs", () =>
        chai.assert.lengthOf(
          Messages.find({ id, type: "rounds" }).fetch(),
          1,
          "oplogs"
        ));
    });
  });

  describe("when a round exists with that name", function () {
    let id1 = null;
    let id2 = null;
    let ret = null;
    beforeEach(function () {
      id1 = Rounds.insert({
        name: "Foo",
        canon: "foo",
        created: 1,
        created_by: "torgen",
        touched: 1,
        touched_by: "torgen",
        link: "https://puzzlehunt.mit.edu/foo",
        tags: {},
      });
      id2 = Rounds.insert({
        name: "Bar",
        canon: "bar",
        created: 2,
        created_by: "cscott",
        touched: 2,
        touched_by: "cscott",
        link: "https://puzzlehunt.mit.edu/foo",
        tags: {},
      });
      ret = callAs("renameRound", "cjb", {
        id: id1,
        name: "Bar",
      });
    });

    it("returns false", () => chai.assert.isFalse(ret));

    it("leaves round alone", () =>
      chai.assert.include(Rounds.findOne(id1), {
        name: "Foo",
        canon: "foo",
        touched: 1,
        touched_by: "torgen",
      }));

    it("doesn't oplog", () =>
      chai.assert.lengthOf(
        Messages.find({ id: { $in: [id1, id2] }, type: "rounds" }).fetch(),
        0
      ));
  });
});
