import codex from "./codex.js";
import "/lib/model.js";
import {
  CallIns,
  Messages,
  Polls,
  Puzzles,
  Rounds,
} from "/lib/imports/collections.js";
import chai from "chai";
import sinon from "sinon";
import { resetDatabase } from "meteor/xolvio:cleaner";
import Robot from "../imports/hubot.js";
import { drive } from "/lib/imports/environment.js";
import { waitForDocument } from "/lib/imports/testutils.js";
import {
  all_settings,
  EmbedPuzzles,
  MaximumMemeLength,
  PuzzleUrlPrefix,
  RoundUrlPrefix,
} from "/lib/imports/settings.js";
import { impersonating } from "../imports/impersonate.js";

describe("codex hubot script", function () {
  let robot = null;
  let clock = null;
  let driveMethods = null;

  beforeEach(function () {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 6,
      toFake: ["Date"],
    });
    // can't use plain hubot because this script uses priv, which isn't part of
    // the standard message class or adapter.
    robot = new Robot("testbot", "testbot@testbot.test");
    codex(robot);
    robot.run();
    clock.tick(1);
    driveMethods = {
      createPuzzle: sinon.fake.returns({
        id: "fid", // f for folder
        spreadId: "sid",
        docId: "did",
      }),
      renamePuzzle: sinon.spy(),
      deletePuzzle: sinon.spy(),
    };
  });

  afterEach(function () {
    robot.shutdown();
    clock.restore();
  });

  describe("setAnswer", function () {
    it("fails when puzzle does not exist", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "puzzles/12345abcde",
        timestamp: Date.now(),
        body: "bot the answer to latino alphabet is linear abeja",
      });
      return waitForDocument(
        Messages,
        { nick: "testbot", timestamp: 7 },
        {
          body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
          room_name: "puzzles/12345abcde",
          useful: true,
          mention: ["torgen"],
        }
      );
    });

    it("sets answer", async function () {
      Puzzles.insert({
        _id: "12345abcde",
        name: "Latino Alphabet",
        canon: "latino_alphabet",
        feedsInto: [],
        tags: {},
      });
      Messages.insert({
        nick: "torgen",
        room_name: "puzzles/12345abcde",
        timestamp: Date.now(),
        body: "bot the answer to latino alphabet is linear abeja",
      });
      await waitForDocument(
        Puzzles,
        { _id: "12345abcde", solved_by: "torgen" },
        {
          touched: 7,
          touched_by: "torgen",
          solved: 7,
          confirmed_by: "torgen",
          tags: {
            answer: {
              name: "Answer",
              value: "linear abeja",
              touched: 7,
              touched_by: "torgen",
            },
          },
        }
      );
      return waitForDocument(
        Messages,
        { nick: "testbot", body: /^@torgen:/ },
        {
          timestamp: 7,
          useful: true,
          room_name: "puzzles/12345abcde",
          mention: ["torgen"],
        }
      );
    });

    it("overwrites answer", async function () {
      Puzzles.insert({
        _id: "12345abcde",
        name: "Latino Alphabet",
        canon: "latino_alphabet",
        feedsInto: [],
        touched: 3,
        touched_by: "cjb",
        solved: 3,
        solved_by: "cscott",
        confirmed_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "vasco de gamma",
            touched: 3,
            touched_by: "cjb",
          },
        },
      });
      Messages.insert({
        nick: "torgen",
        room_name: "puzzles/12345abcde",
        timestamp: Date.now(),
        body: "bot the answer to latino alphabet is linear abeja",
      });
      await waitForDocument(
        Puzzles,
        { _id: "12345abcde", solved_by: "torgen", confirmed_by: "torgen" },
        {
          touched: 7,
          touched_by: "torgen",
          solved: 7,
          tags: {
            answer: {
              name: "Answer",
              value: "linear abeja",
              touched: 7,
              touched_by: "torgen",
            },
          },
        }
      );
      return waitForDocument(
        Messages,
        { nick: "testbot", body: /^@torgen:/ },
        {
          timestamp: 7,
          useful: true,
          room_name: "puzzles/12345abcde",
          mention: ["torgen"],
        }
      );
    });

    it("leaves old answer", async function () {
      Puzzles.insert({
        _id: "12345abcde",
        name: "Latino Alphabet",
        canon: "latino_alphabet",
        feedsInto: [],
        solved: 3,
        solved_by: "cscott",
        confirmed_by: "cjb",
        touched: 3,
        touched_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "linear abeja",
            touched: 3,
            touched_by: "cjb",
          },
        },
      });
      Messages.insert({
        nick: "torgen",
        room_name: "puzzles/12345abcde",
        timestamp: Date.now(),
        body: "bot the answer to latino alphabet is linear abeja",
      });
      await waitForDocument(
        Messages,
        { nick: "testbot", body: /^@torgen:/ },
        {
          timestamp: 7,
          useful: true,
          room_name: "puzzles/12345abcde",
          mention: ["torgen"],
        }
      );
      chai.assert.deepInclude(Puzzles.findOne({ _id: "12345abcde" }), {
        touched: 3,
        touched_by: "cjb",
        solved: 3,
        solved_by: "cscott",
        confirmed_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "linear abeja",
            touched: 3,
            touched_by: "cjb",
          },
        },
      });
    });
  });

  describe("deleteAnswer", function () {
    it("deletes answer", async function () {
      Puzzles.insert({
        _id: "12345abcde",
        name: "Latino Alphabet",
        canon: "latino_alphabet",
        feedsInto: [],
        touched: 3,
        touched_by: "cjb",
        solved: 3,
        solved_by: "cjb",
        tags: {
          answer: {
            name: "Answer",
            value: "vasco de gamma",
            touched: 3,
            touched_by: "cjb",
          },
        },
      });
      Messages.insert({
        nick: "torgen",
        room_name: "puzzles/fghij67890",
        timestamp: Date.now(),
        body: "bot delete answer for latino alphabet",
      });
      await waitForDocument(
        Puzzles,
        { _id: "12345abcde", "tags.answer": { $exists: false } },
        {
          touched: 7,
          touched_by: "torgen",
        }
      );
      return waitForDocument(
        Messages,
        { nick: "testbot", body: /^@torgen:/ },
        {
          timestamp: 7,
          useful: true,
          room_name: "puzzles/fghij67890",
          mention: ["torgen"],
        }
      );
    });

    it("fails when no such puzzle exists", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot delete answer for latino alphabet",
      });
      return waitForDocument(
        Messages,
        { nick: "testbot", timestamp: 7 },
        {
          body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
    });
  });

  describe("newCallIn", function () {
    describe("of answer", function () {
      describe("in puzzle room", function () {
        it("infers puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot call in linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "answer",
            }
          );
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/fghij67890",
            timestamp: Date.now(),
            body: "bot call in linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "answer",
            }
          );
        });

        it("understands backsolved", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot call in backsolved linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              backsolve: true,
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "answer",
            }
          );
        });

        it("understands provided", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot call in provided linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              provided: true,
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "answer",
            }
          );
        });
      });

      describe("in general room", function () {
        it("fails when puzzle is not specified", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot call in linear abeja",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: "@torgen: You need to tell me which puzzle this is for.",
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("fails when puzzle does not exist", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot call in linear abeja for latino alphabet",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot call in linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "answer",
            }
          );
        });
      });
    });

    describe("of interaction request", function () {
      describe("in puzzle room", function () {
        it("infers puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot request interaction linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "interaction request",
            }
          );
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/fghij67890",
            timestamp: Date.now(),
            body: "bot request interaction linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "interaction request",
            }
          );
        });
      });

      describe("in general room", function () {
        it("fails when puzzle is not specified", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot request interaction linear abeja",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: "@torgen: You need to tell me which puzzle this is for.",
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("fails when puzzle does not exist", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot request interaction linear abeja for latino alphabet",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot request interaction linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "interaction request",
            }
          );
        });
      });
    });

    describe("of message to hq", function () {
      describe("in puzzle room", function () {
        it("infers puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot tell HQ linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "message to hq",
            }
          );
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/fghij67890",
            timestamp: Date.now(),
            body: "bot tell HQ linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "message to hq",
            }
          );
        });
      });

      describe("in general room", function () {
        it("fails when puzzle is not specified", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot tell HQ linear abeja",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: "@torgen: You need to tell me which puzzle this is for.",
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("fails when puzzle does not exist", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot tell HQ linear abeja for latino alphabet",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot tell HQ linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "message to hq",
            }
          );
        });
      });
    });

    describe("of expected callback", function () {
      describe("in puzzle room", function () {
        it("infers puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/12345abcde",
            timestamp: Date.now(),
            body: "bot expect  callback linear abeja",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "expected callback",
            }
          );
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "puzzles/fghij67890",
            timestamp: Date.now(),
            body: "bot expect callback linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "expected callback",
            }
          );
        });
      });

      describe("in general room", function () {
        it("fails when puzzle is not specified", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot expect callback linear abeja",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: "@torgen: You need to tell me which puzzle this is for.",
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("fails when puzzle does not exist", async function () {
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot expect callback linear abeja for latino alphabet",
          });
          await waitForDocument(
            Messages,
            { nick: "testbot", timestamp: 7 },
            {
              body: '@torgen: I can\'t find a puzzle called "latino alphabet".',
              room_name: "general/0",
              useful: true,
              mention: ["torgen"],
            }
          );
          chai.assert.isUndefined(CallIns.findOne());
        });

        it("allows specifying puzzle", function () {
          Puzzles.insert({
            _id: "12345abcde",
            name: "Latino Alphabet",
            canon: "latino_alphabet",
            feedsInto: [],
            tags: {},
          });
          Messages.insert({
            nick: "torgen",
            room_name: "general/0",
            timestamp: Date.now(),
            body: "bot expect callback linear abeja for latino alphabet",
          });
          return waitForDocument(
            CallIns,
            { answer: "linear abeja" },
            {
              target: "12345abcde",
              created: 7,
              created_by: "torgen",
              touched: 7,
              touched_by: "torgen",
              callin_type: "expected callback",
            }
          );
        });
      });
    });
  });

  describe("newPuzzle", () =>
    drive.withValue(driveMethods, function () {
      beforeEach(() => PuzzleUrlPrefix.ensure());

      it("creates in named meta", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in even this poem",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [mid],
          }
        );
        await waitForDocument(Puzzles, { _id: mid, puzzles: puzz._id }, {});
        return waitForDocument(
          Rounds,
          { _id: rid, puzzles: [mid, puzz._id] },
          {}
        );
      });

      it("created with specified link", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in even this poem with url https://bluedot.sg/puzz/la",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [mid],
            link: "https://bluedot.sg/puzz/la",
          }
        );
        await waitForDocument(Puzzles, { _id: mid, puzzles: puzz._id }, {});
        return waitForDocument(
          Rounds,
          { _id: rid, puzzles: [mid, puzz._id] },
          {}
        );
      });

      it("creates in this meta", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: `puzzles/${mid}`,
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in this",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [mid],
          }
        );
        return waitForDocument(Puzzles, { _id: mid, puzzles: puzz._id }, {});
      });

      it("creates in named round", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in elliptic curve",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [],
          }
        );
        await waitForDocument(
          Rounds,
          { _id: rid, puzzles: [mid, puzz._id] },
          {}
        );
        chai.assert.deepInclude(Puzzles.findOne(mid), { puzzles: [] });
      });

      it("fails when one exists by that name", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Even this poem is a new puzzle in elliptic curve",
        });
        await waitForDocument(
          Messages,
          {
            body: {
              $regex: /@torgen: There's already.*a puzzle named Even This Poem/,
            },
          },
          {
            nick: "testbot",
            timestamp: 7,
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.deepInclude(Rounds.findOne(rid), { puzzles: [mid] });
      });

      it("creates in this round", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: `rounds/${rid}`,
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in this",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet", puzzles: null },
          {
            canon: "latino_alphabet",
            feedsInto: [],
          }
        );
        await waitForDocument(
          Rounds,
          { _id: rid, puzzles: [mid, puzz._id] },
          {}
        );
        chai.assert.deepInclude(Puzzles.findOne(mid), { puzzles: [] });
      });

      it("creates meta in this round", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: `rounds/${rid}`,
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new meta in this",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [],
            puzzles: [],
          }
        );
        await waitForDocument(
          Rounds,
          { _id: rid, puzzles: [mid, puzz._id] },
          {}
        );
        chai.assert.deepInclude(Puzzles.findOne(mid), { puzzles: [] });
      });

      it("fails when this is not a puzzle or round", async function () {
        const mid = Puzzles.insert({
          name: "Even This Poem",
          canon: "even_this_poem",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [mid],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in this",
        });
        await waitForDocument(
          Messages,
          { body: "@torgen: You need to tell me which puzzle this is for." },
          {
            nick: "testbot",
            timestamp: 7,
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.deepInclude(Puzzles.findOne(mid), { puzzles: [] });
        chai.assert.deepInclude(Rounds.findOne(rid), { puzzles: [mid] });
      });

      it("allows specifying type to create in", async function () {
        const mid = Puzzles.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          feedsInto: [],
          puzzles: [],
        });
        const rid = Rounds.insert({
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          puzzles: [],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in round elliptic curve",
        });
        const puzz = await waitForDocument(
          Puzzles,
          { name: "Latino Alphabet" },
          {
            canon: "latino_alphabet",
            feedsInto: [],
          }
        );
        await waitForDocument(Rounds, { _id: rid, puzzles: [puzz._id] }, {});
        chai.assert.deepInclude(Puzzles.findOne(mid), { puzzles: [] });
      });

      it("fails when no such thing to create in", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot Latino Alphabet is a new puzzle in elliptic curve",
        });
        return waitForDocument(
          Messages,
          { body: '@torgen: I can\'t find anything called "elliptic curve".' },
          {
            nick: "testbot",
            timestamp: 7,
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
      });
    }));

  describe("deletePuzzle", () =>
    drive.withValue(driveMethods, function () {
      it("deletes puzzle", async function () {
        const pid = Puzzles.insert({
          name: "Foo",
          canon: "foo",
          feedsInto: [],
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot delete puzzle foo",
        });
        await waitForDocument(
          Messages,
          { body: '@torgen: Okay, I deleted "Foo".' },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.isUndefined(Puzzles.findOne({ _id: pid }));
      });

      it("fails when puzzle does not exist", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot delete puzzle foo",
        });
        return waitForDocument(
          Messages,
          { body: '@torgen: I can\'t find a puzzle called "foo".' },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            useful: true,
            mention: ["torgen"],
          }
        );
      });
    }));

  describe("newRound", function () {
    it("creates round", function () {
      RoundUrlPrefix.ensure();
      impersonating("testbot", () =>
        RoundUrlPrefix.set("https://moliday.holasses/round")
      );
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot Elliptic Curve is a new round",
      });
      return waitForDocument(
        Rounds,
        { name: "Elliptic Curve" },
        {
          canon: "elliptic_curve",
          created: 7,
          created_by: "torgen",
          touched: 7,
          touched_by: "torgen",
          puzzles: [],
          sort_key: 7,
          link: "https://moliday.holasses/round/elliptic_curve",
        }
      );
    });

    it("creates round with specified link", function () {
      RoundUrlPrefix.ensure();
      impersonating("testbot", () =>
        RoundUrlPrefix.set("https://moliday.holasses/round")
      );
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot Elliptic Curve is a new round with link https://moliday.holasses/circular",
      });
      return waitForDocument(
        Rounds,
        { name: "Elliptic Curve" },
        {
          canon: "elliptic_curve",
          created: 7,
          created_by: "torgen",
          touched: 7,
          touched_by: "torgen",
          puzzles: [],
          sort_key: 7,
          link: "https://moliday.holasses/circular",
        }
      );
    });

    it("fails when one exists by that name", async function () {
      const rid = Rounds.insert({
        name: "Elliptic Curve",
        canon: "elliptic_curve",
        puzzles: [],
      });
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot elliptic curve is a new round",
      });
      return await waitForDocument(
        Messages,
        {
          body: {
            $regex: /@torgen: There's already.*a round named Elliptic Curve/,
          },
        },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
    });
  });

  describe("deleteRound", function () {
    it("deletes empty round", async function () {
      const rid = Rounds.insert({
        name: "Elliptic Curve",
        canon: "elliptic_curve",
        puzzles: [],
      });
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot delete round elliptic curve",
      });
      await waitForDocument(
        Messages,
        { body: '@torgen: Okay, I deleted round "Elliptic Curve".' },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
      chai.assert.isUndefined(Rounds.findOne({ _id: rid }));
    });

    it("fails when round contains puzzles", async function () {
      const rid = Rounds.insert({
        name: "Elliptic Curve",
        canon: "elliptic_curve",
        puzzles: ["1"],
      });
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot delete round elliptic curve",
      });
      await waitForDocument(
        Messages,
        {
          body: "@torgen: Couldn't delete round. (Are there still puzzles in it?)",
        },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
      chai.assert.isObject(Rounds.findOne({ _id: rid }));
    });

    it("fails when round does not exist", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot delete round elliptic curve",
      });
      return waitForDocument(
        Messages,
        { body: '@torgen: I can\'t find a round called "elliptic curve".' },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
    });
  });

  describe("setTag", function () {
    describe("in puzzle room", function () {
      it("infers puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot set Color to blue",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Puzzles.insert({
          _id: "fghij67890",
          name: "Even This Poem",
          canon: "even_this_poem",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/fghij67890",
          timestamp: Date.now(),
          body: "bot set Color for latino alphabet to blue",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });

      it("allows specifying round", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot set Color for elliptic curve to blue",
        });
        return waitForDocument(
          Rounds,
          { _id: "fghij67890", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });
    });

    describe("in round room", function () {
      it("infers round", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot set Color to blue",
        });
        return waitForDocument(
          Rounds,
          { _id: "fghij67890", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });

      it("allows specifying puzzle", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot set Color for latino alphabet to blue",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });

      it("allows specifying round", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot set Color of latino alphabet to blue",
        });
        return waitForDocument(
          Rounds,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });
    });

    describe("in general room", function () {
      it("fails when target is not specified", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot set Color to blue",
        });
        return waitForDocument(
          Messages,
          { body: "@torgen: You need to tell me which puzzle this is for." },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });

      it("fails when target does not exist", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot set Color for latino alphabet to blue",
        });
        return waitForDocument(
          Messages,
          { body: '@torgen: I can\'t find anything called "latino alphabet".' },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot set Color for latino alphabet to blue",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });

      it("allows specifying round", function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot set Color for latino alphabet to blue",
        });
        return waitForDocument(
          Rounds,
          { _id: "12345abcde", "tags.color.value": "blue" },
          {
            tags: {
              color: {
                name: "Color",
                touched_by: "torgen",
                touched: 7,
                value: "blue",
              },
            },
          }
        );
      });
    });
  });

  describe("deleteTag", function () {
    describe("in puzzle room", function () {
      it("infers puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot unset Color",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Puzzles.insert({
          _id: "fghij67890",
          name: "Even This Poem",
          canon: "even_this_poem",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/fghij67890",
          timestamp: Date.now(),
          body: "bot unset Color for latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });

      it("allows specifying round", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot unset Color for elliptic curve",
        });
        return waitForDocument(
          Rounds,
          { _id: "fghij67890", "tags.color": { $exists: false } },
          {}
        );
      });

      it("complains if not set ", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot unset Color",
        });
        return waitForDocument(
          Messages,
          { body: "@torgen: Latino Alphabet didn't have Color set!" },
          {
            nick: "testbot",
            room_name: "puzzles/12345abcde",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });
    });

    describe("in round room", function () {
      it("infers round", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot unset Color",
        });
        return waitForDocument(
          Rounds,
          { _id: "fghij67890", "tags.color": { $exists: false } },
          {}
        );
      });

      it("allows specifying puzzle", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot unset Color for latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });

      it("allows specifying round", function () {
        Rounds.insert({
          _id: "fghij67890",
          name: "Elliptic Curve",
          canon: "elliptic_curve",
          tags: {},
        });
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/fghij67890",
          timestamp: Date.now(),
          body: "bot unset Color of latino alphabet",
        });
        return waitForDocument(
          Rounds,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });

      it("complains if not set ", function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/12345abcde",
          timestamp: Date.now(),
          body: "bot unset Color",
        });
        return waitForDocument(
          Messages,
          { body: "@torgen: Latino Alphabet didn't have Color set!" },
          {
            nick: "testbot",
            room_name: "rounds/12345abcde",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });
    });

    describe("in general room", function () {
      it("fails when target is not specified", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unset Color",
        });
        return waitForDocument(
          Messages,
          { body: "@torgen: You need to tell me which puzzle this is for." },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });

      it("fails when target does not exist", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unset Color for latino alphabet",
        });
        return waitForDocument(
          Messages,
          { body: '@torgen: I can\'t find anything called "latino alphabet".' },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            mention: ["torgen"],
          }
        );
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unset Color for latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });

      it("allows specifying round", function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            color: {
              value: "blue",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unset Color for latino alphabet",
        });
        return waitForDocument(
          Rounds,
          { _id: "12345abcde", "tags.color": { $exists: false } },
          {}
        );
      });
    });
  });

  describe("stuck", function () {
    describe("in puzzle room", function () {
      it("marks stuck without reason", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot stuck",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.status.value": "Stuck" },
          {
            tags: {
              status: {
                name: "Status",
                touched_by: "torgen",
                touched: 7,
                value: "Stuck",
              },
            },
          }
        );
      });

      it("marks stuck with reason", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot stuck because maparium is closed",
        });
        return waitForDocument(
          Puzzles,
          {
            _id: "12345abcde",
            "tags.status.value": "Stuck: maparium is closed",
          },
          {
            tags: {
              status: {
                name: "Status",
                touched_by: "torgen",
                touched: 7,
                value: "Stuck: maparium is closed",
              },
            },
          }
        );
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Puzzles.insert({
          _id: "fghij67890",
          name: "Even This Poem",
          canon: "even_this_poem",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot stuck on even this poem because maparium is closed",
        });
        return waitForDocument(
          Puzzles,
          {
            _id: "fghij67890",
            "tags.status.value": "Stuck: maparium is closed",
          },
          {
            tags: {
              status: {
                name: "Status",
                touched_by: "torgen",
                touched: 7,
                value: "Stuck: maparium is closed",
              },
            },
          }
        );
      });
    });

    describe("in general room", function () {
      it("marks stuck without reason", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot stuck on latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", "tags.status.value": "Stuck" },
          {
            tags: {
              status: {
                name: "Status",
                touched_by: "torgen",
                touched: 7,
                value: "Stuck",
              },
            },
          }
        );
      });

      it("marks stuck with reason", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot stuck on latino alphabet because maparium is closed",
        });
        return waitForDocument(
          Puzzles,
          {
            _id: "12345abcde",
            "tags.status.value": "Stuck: maparium is closed",
          },
          {
            tags: {
              status: {
                name: "Status",
                touched_by: "torgen",
                touched: 7,
                value: "Stuck: maparium is closed",
              },
            },
          }
        );
      });

      it("fails without puzzle", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot stuck because maparium is closed",
        });
        return waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: "@torgen: You need to tell me which puzzle this is for.",
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
      });

      it("fails on round", async function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot stuck on latino alphabet because maparium is closed",
        });
        await waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: '@torgen: I don\'t know what "latino alphabet" is.',
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.deepInclude(Rounds.findOne("12345abcde"), {
          tags: {},
        });
      });
    });

    describe("in round room", () =>
      it("fails without puzzle", function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/12345abcde",
          timestamp: Date.now(),
          body: "bot stuck because maparium is closed",
        });
        return waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: "@torgen: Only puzzles can be stuck.",
            room_name: "rounds/12345abcde",
            useful: true,
            mention: ["torgen"],
          }
        );
      }));
  });

  describe("unstuck", function () {
    describe("in puzzle room", function () {
      it("marks unstuck", async function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 6,
              touched_by: "torgen",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot unstuck",
        });
        await waitForDocument(
          Messages,
          { nick: "torgen", room_name: "puzzles/12345abcde", action: true },
          {
            body: "no longer needs help getting unstuck",
            timestamp: 7,
          }
        );
        chai.assert.deepInclude(Puzzles.findOne("12345abcde"), {
          tags: {},
        });
      });

      it("is here to help", async function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 6,
              touched_by: "cjb",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/12345abcde",
          timestamp: Date.now(),
          body: "bot unstuck",
        });
        await waitForDocument(
          Messages,
          { nick: "torgen", room_name: "puzzles/12345abcde", action: true },
          {
            body: "has arrived to help",
            timestamp: 7,
          }
        );
        chai.assert.deepInclude(Puzzles.findOne("12345abcde"), {
          tags: {},
        });
      });

      it("allows specifying puzzle", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 6,
              touched_by: "cjb",
            },
          },
        });
        Puzzles.insert({
          _id: "fghij67890",
          name: "Even This Poem",
          canon: "even_this_poem",
          tags: {},
        });
        Messages.insert({
          nick: "torgen",
          room_name: "puzzles/fghij67890",
          timestamp: Date.now(),
          body: "bot unstuck on latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", tags: {} },
          {
            touched: 7,
            touched_by: "torgen",
          }
        );
      });
    });

    describe("in general room", function () {
      it("marks unstuck", function () {
        Puzzles.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 6,
              touched_by: "cjb",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unstuck on latino alphabet",
        });
        return waitForDocument(
          Puzzles,
          { _id: "12345abcde", tags: {} },
          {
            touched: 7,
            touched_by: "torgen",
          }
        );
      });

      it("fails without puzzle", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unstuck",
        });
        return waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: "@torgen: You need to tell me which puzzle this is for.",
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
      });

      it("fails when no such puzzle", function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot unstuck on latino alphabet",
        });
        return waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: '@torgen: I don\'t know what "latino alphabet" is.',
            room_name: "general/0",
            useful: true,
            mention: ["torgen"],
          }
        );
      });
    });

    describe("in round room", () =>
      it("fails without puzzle", function () {
        Rounds.insert({
          _id: "12345abcde",
          name: "Latino Alphabet",
          canon: "latino_alphabet",
          tags: {
            status: {
              name: "Status",
              value: "Stuck",
              touched: 6,
              touched_by: "cjb",
            },
          },
        });
        Messages.insert({
          nick: "torgen",
          room_name: "rounds/12345abcde",
          timestamp: Date.now(),
          body: "bot unstuck",
        });
        return waitForDocument(
          Messages,
          { nick: "testbot", timestamp: 7 },
          {
            body: "@torgen: Only puzzles can be stuck.",
            room_name: "rounds/12345abcde",
            useful: true,
            mention: ["torgen"],
          }
        );
      }));
  });

  describe("poll", function () {
    it("creates poll", async function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: 'bot poll "Who you got?" us "the field"',
      });
      const poll = await waitForDocument(
        Polls,
        {},
        {
          question: "Who you got?",
          created: 7,
          created_by: "torgen",
          options: [
            { canon: "us", option: "us" },
            { canon: "the_field", option: "the field" },
          ],
          votes: {},
        }
      );
      return await waitForDocument(
        Messages,
        { poll: poll._id },
        {
          nick: "torgen",
          room_name: "general/0",
          timestamp: 7,
        }
      );
    });

    it("requires two options", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: 'bot poll "Vote for me!" OK',
      });
      return waitForDocument(
        Messages,
        { body: "@torgen: Must have between 2 and 5 options." },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
    });

    it("forbids more than five options", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: 'bot poll "Best dwarf" Grumpy Happy Sleepy Sneezy Dopey Bashful Doc',
      });
      return waitForDocument(
        Messages,
        { body: "@torgen: Must have between 2 and 5 options." },
        {
          nick: "testbot",
          timestamp: 7,
          room_name: "general/0",
          useful: true,
          mention: ["torgen"],
        }
      );
    });
  });

  describe("global list", () =>
    it("lists global settings", async function () {
      let k, v;
      for (k in all_settings) {
        v = all_settings[k];
        v.ensure();
      }
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot global list",
      });
      for (k in all_settings) {
        v = all_settings[k];
        await waitForDocument(
          Messages,
          {
            nick: "testbot",
            to: "torgen",
            body: new RegExp(`^${v.name}:`),
          },
          {
            room_name: "general/0",
            timestamp: 7,
            useful: true,
          }
        );
      }
    }));

  describe("global set", function () {
    beforeEach(function () {
      for (let k in all_settings) {
        all_settings[k].ensure();
      }
    });

    it("sets number", async function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot global set maximum meme length to 97",
      });
      await waitForDocument(
        Messages,
        { body: "@torgen: OK, set maximum meme length to 97" },
        {
          nick: "testbot",
          room_name: "general/0",
          timestamp: 7,
          useful: true,
          mention: ["torgen"],
        }
      );
      chai.assert.equal(97, MaximumMemeLength.get());
    });

    it("sets boolean", async function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot global set embed puzzles to false",
      });
      await waitForDocument(
        Messages,
        { body: "@torgen: OK, set embed puzzles to false" },
        {
          nick: "testbot",
          room_name: "general/0",
          timestamp: 7,
          useful: true,
          mention: ["torgen"],
        }
      );
      chai.assert.isFalse(EmbedPuzzles.get());
    });

    it("sets url", async function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot global set round url prefix to https://moliday.holasses/round",
      });
      await waitForDocument(
        Messages,
        {
          body: "@torgen: OK, set round url prefix to https://moliday.holasses/round",
        },
        {
          nick: "testbot",
          room_name: "general/0",
          timestamp: 7,
          useful: true,
          mention: ["torgen"],
        }
      );
      chai.assert.equal("https://moliday.holasses/round", RoundUrlPrefix.get());
    });

    it("fails when setting does not exist", function () {
      Messages.insert({
        nick: "torgen",
        room_name: "general/0",
        timestamp: Date.now(),
        body: "bot global set background color to black",
      });
      return waitForDocument(
        Messages,
        {
          body: "@torgen: Sorry, I don't know the setting 'background color'.",
        },
        {
          nick: "testbot",
          room_name: "general/0",
          timestamp: 7,
          useful: true,
          mention: ["torgen"],
        }
      );
    });

    describe("when value has wrong format for setting", function () {
      it("fails for boolean", async function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot global set embed puzzles to maybe",
        });
        await waitForDocument(
          Messages,
          { body: /^@torgen: Sorry, there was an error:/ },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.isTrue(EmbedPuzzles.get());
      });

      it("fails for url", async function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot global set round url prefix to twelve",
        });
        await waitForDocument(
          Messages,
          { body: /^@torgen: Sorry, there was an error:/ },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.equal("", RoundUrlPrefix.get());
      });

      it("fails for number", async function () {
        Messages.insert({
          nick: "torgen",
          room_name: "general/0",
          timestamp: Date.now(),
          body: "bot global set maximum meme length to twelve",
        });
        await waitForDocument(
          Messages,
          { body: /^@torgen: Sorry, there was an error:/ },
          {
            nick: "testbot",
            room_name: "general/0",
            timestamp: 7,
            useful: true,
            mention: ["torgen"],
          }
        );
        chai.assert.equal(140, MaximumMemeLength.get());
      });
    });
  });
});
