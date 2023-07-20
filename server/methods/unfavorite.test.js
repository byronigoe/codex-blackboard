// For side effects
import "/lib/model.js";
import { Puzzles } from "/lib/imports/collections.js";
import { callAs } from "/server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";

describe("unfavorite", function () {
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

  describe("when no such puzzle", function () {
    it("fails without login", () =>
      chai.assert.throws(() => Meteor.call("unfavorite", "id"), Match.Error));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(() => (ret = callAs("unfavorite", "cjb", "id")));

      it("returns false", () => chai.assert.isFalse(ret));
    });
  });

  describe("when favorites is absent", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "torgen",
          touched: 1,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          link: "https://puzzlehunt.mit.edu/foo",
          drive: "fid",
          spreadsheet: "sid",
          doc: "did",
          tags: {},
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(() => Meteor.call("favorite", id), Match.Error));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(() => (ret = callAs("unfavorite", "cjb", id)));

      it("returns true", () => chai.assert.isTrue(ret));

      it("leaves favorites unset", () =>
        chai.assert.isUndefined(Puzzles.findOne(id).favorites));

      it("does not touch", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });

  describe("when favorites has others", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "torgen",
          touched: 1,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          favorites: {
            torgen: true,
            cscott: true,
          },
          link: "https://puzzlehunt.mit.edu/foo",
          drive: "fid",
          spreadsheet: "sid",
          doc: "did",
          tags: {},
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(() => Meteor.call("unfavorite", id), Match.Error));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(() => (ret = callAs("unfavorite", "cjb", id)));

      it("returns true", () => chai.assert.isTrue(ret));

      it("leaves favorites unchanged", () =>
        chai.assert.deepEqual(Puzzles.findOne(id).favorites, {
          torgen: true,
          cscott: true,
        }));

      it("does not touch", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });

  describe("when favorites has self", function () {
    let id = null;
    beforeEach(
      () =>
        (id = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          created: 1,
          created_by: "torgen",
          touched: 1,
          touched_by: "torgen",
          solved: null,
          solved_by: null,
          favorites: {
            torgen: true,
            cjb: true,
          },
          link: "https://puzzlehunt.mit.edu/foo",
          drive: "fid",
          spreadsheet: "sid",
          doc: "did",
          tags: {},
        }))
    );

    it("fails without login", () =>
      chai.assert.throws(() => Meteor.call("unfavorite", id), Match.Error));

    describe("when logged in", function () {
      let ret = null;
      beforeEach(() => (ret = callAs("unfavorite", "cjb", id)));

      it("returns true", () => chai.assert.isTrue(ret));

      it("removes self from favorites", () =>
        chai.assert.deepEqual(Puzzles.findOne(id).favorites, { torgen: true }));

      it("does not touch", function () {
        const doc = Puzzles.findOne(id);
        chai.assert.equal(doc.touched, 1);
        chai.assert.equal(doc.touched_by, "torgen");
      });
    });
  });
});
