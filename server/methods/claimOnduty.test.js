// For side effetcs
import "/lib/model.js";
import { Messages, Roles } from "/lib/imports/collections.js";
import { callAs, impersonating } from "../../server/imports/impersonate.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import { RoleRenewalTime } from "/lib/imports/settings.js";

describe("claimOnduty", function () {
  let clock = null;

  beforeEach(
    () =>
      (clock = sinon.useFakeTimers({
        now: 7,
        toFake: ["Date"],
      }))
  );

  afterEach(() => clock.restore());

  beforeEach(function () {
    resetDatabase();
    RoleRenewalTime.ensure();
  });

  it("fails without login", () =>
    chai.assert.throws(
      () => Meteor.call("claimOnduty", { from: "cjb" }),
      Match.Error
    ));

  describe("when nobody is onduty", function () {
    it("claims onduty from nobody", function () {
      callAs("claimOnduty", "torgen", { from: null });
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = Messages.find({ room_name: "oplog/0" }).fetch();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "is now",
      });
    });

    it("claims onduty from anybody", function () {
      callAs("claimOnduty", "torgen", { from: "cscott" });
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = Messages.find({ room_name: "oplog/0" }).fetch();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "is now",
      });
    });

    it("uses setting for renewal time", function () {
      impersonating("cjb", () => RoleRenewalTime.set(30));
      callAs("claimOnduty", "torgen", { from: "cscott" });
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 1800007,
      });
    });
  });

  describe("when somebody is onduty", function () {
    beforeEach(() =>
      Roles.insert({
        _id: "onduty",
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      })
    );

    it("claims onduty from them", function () {
      callAs("claimOnduty", "torgen", { from: "cjb" });
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "torgen",
        claimed_at: 7,
        renewed_at: 7,
        expires_at: 3600007,
      });
      const o = Messages.find({ room_name: "oplog/0" }).fetch();
      chai.assert.lengthOf(o, 1);
      chai.assert.include(o[0], {
        type: "roles",
        id: "onduty",
        stream: "onduty",
        nick: "torgen",
        body: "took over from @cjb as",
      });
    });

    it("fails to claim onduty from somebody else", function () {
      chai.assert.throws(
        () => callAs("claimOnduty", "torgen", { from: "cscott" }),
        Meteor.Error,
        /412/
      );
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      });
    });

    it("fails to claim onduty from nobody", function () {
      chai.assert.throws(
        () => callAs("claimOnduty", "torgen", { from: null }),
        Meteor.Error,
        /412/
      );
      chai.assert.deepInclude(Roles.findOne("onduty"), {
        holder: "cjb",
        claimed_at: 1,
        renewed_at: 1,
        expires_at: 3600001,
      });
    });
  });
});
