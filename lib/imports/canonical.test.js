import canonical from "./canonical.js";
import chai from "chai";

function testcase(before, after) {
  describe(before, function () {
    it(`canonicalizes to ${after}`, () => chai.assert.equal(canonical(before), after));
    it("is idempotent", () =>
      chai.assert.equal(canonical(canonical(before)), canonical(before)));
  });
}

describe("canonical", function () {
  describe("strips whitespace", function () {
    testcase("  leading", "leading");
    testcase("trailing  ", "trailing");
    testcase("_id", "id");
  });

  describe("converts to lowercase", () => testcase("HappyTime", "happytime"));

  describe("converts space to underscore", function () {
    testcase("sport of princesses", "sport_of_princesses");
    testcase("sport  of  princesses", "sport_of_princesses");
  });

  describe("converts non-alphanumeric to underscore", function () {
    testcase("Whomst'd've", "whomst_d_ve");
    testcase("ca$h", "ca_h");
    testcase("command.com", "command_com");
    testcase("2chainz", "2chainz");
  });

  describe("deletes possessive and contraction apostrophes", function () {
    testcase("bill's", "bills");
    testcase("don't", "dont");
  });

  describe("removes accents", function () {
    testcase("Olá, você aí", "ola_voce_ai");
    // Đ is a distinct letter from D in vietnamese, not D with a diacritic
    testcase(
      "Đó là một ngày tháng tư sáng lạnh",
      "o_la_mot_ngay_thang_tu_sang_lanh"
    );
  });

  describe("flags", function () {
    testcase("Oh 🇨🇦!", "oh_🇨🇦");
    testcase("🏴‍☠️ Yo ho ho!", "🏴‍☠️_yo_ho_ho");
  });

  describe("emoji", function () {
    // emoji-named puzzles from recent hunts
    testcase("✏️✉️➡️3️⃣5️⃣1️⃣➖6️⃣6️⃣6️⃣➖6️⃣6️⃣5️⃣5️⃣", "✏️✉️➡️351➖666➖6655");
    testcase("🤔", "🤔");
    testcase("🔔🦇🦇🦇", "🔔🦇🦇🦇");
    testcase("❤️ & ☮️", "❤️_☮️");
    testcase("★", "★");
  });

  it("allows specifying replacement string", () =>
    chai.assert.equal(
      canonical("  leading and trailing  ", "-"),
      "leading-and-trailing"
    ));
});
