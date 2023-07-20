import "./graph.html";
import { Puzzles, Rounds } from "/lib/imports/collections.js";
import { isStuck } from "/lib/imports/tags.js";
import objectColor from "/client/imports/objectColor.js";
import abbrev from "/lib/imports/abbrev.js";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import layout_utilities from "cytoscape-layout-utilities";

cytoscape.use(fcose);
cytoscape.use(layout_utilities);

Template.graph.events({
  "bb-layout .bb-status-graph"(event, template) {
    template.layout?.(event);
  },
});

Template.graph.onCreated(function () {
  this.adding = new ReactiveVar(false);
});

Template.graph.onDestroyed(function () {
  this.rounds?.stop();
  this.puzzles?.stop();
  window.removeEventListener("resize", this.layout);
});

Template.graph.onRendered(function () {
  this.status = "idle";
  this.cy = cytoscape({
    container: this.$(".bb-status-graph"),
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
        },
      },
      {
        selector: "edge",
        style: {
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
          "target-arrow-color": "black",
          "line-color": "black",
        },
      },
      {
        selector: "node > node",
        style: {
          label: "data(label)",
          width: "label",
          height: "label",
          padding: "0.5em",
          "font-size": "1em",
          "text-halign": "center",
          "text-valign": "center",
        },
      },
      {
        selector: "node.meta",
        style: {
          "border-width": "2px",
          "border-style": "solid",
          "border-color": "data(color)",
          "font-size": "2em",
        },
      },
      {
        selector: "node.stuck",
        style: {
          "background-color": "yellow",
        },
      },
      {
        selector: "node.solved",
        style: {
          "background-color": "lime",
        },
      },
    ],
  });
  this.cy
    .userPanningEnabled(false)
    .userZoomingEnabled(false)
    .autounselectify(true);
  this.setAspect = () => {
    this.cy.layoutUtilities({
      desiredAspectRatio: $(window).width() / $(window).height(),
    });
  };
  this.setAspect();
  const startAdding = () => {
    if (!this.adding.get()) {
      this.cy.startBatch();
      this.adding.set(true);
    }
  };
  this.layout = async (event) => {
    if (event != null) {
      this.roundChange = true;
    }
    if (this.status === "idle") {
      this.status = "running";
    } else {
      this.status = "waiting";
      return;
    }
    while (true) {
      this.setAspect();
      console.log(
        `laying out structure: ${this.structure} roundChange: ${this.roundChange}`
      );
      const lay = this.cy.layout({
        name: "fcose",
        randomize: this.roundChange,
        edgeElasticity: 0.1,
        quality: "proof",
        nodeDimensionsIncludeLabels: true,
      });
      const p = lay.promiseOn("layoutstop");
      lay.run();
      await p;
      this.cy
        .container()
        .dispatchEvent(new Event("bb-graph-render", { bubbles: true }));
      if (this.status === "running") {
        this.status = "idle";
        break;
      } else {
        this.status = "running";
      }
    }
    this.structure = false;
    this.roundChange = false;
  };

  this.autorun(() => {
    if (this.adding.get()) {
      this.cy.endBatch();
      if (this.structure) {
        this.layout();
      }
      this.adding.set(false);
    }
  });
  window.addEventListener("resize", this.layout);
  const addOrMove = (round_id, puzzle_id) => {
    const puzz_cy_id = `puzzles_${puzzle_id}`;
    const puzz_node = this.cy.$id(puzz_cy_id);
    this.structure = true;
    if (puzz_node.empty()) {
      this.cy.add({
        group: "nodes",
        data: {
          id: puzz_cy_id,
          parent: round_id,
        },
      });
    } else {
      puzz_node.move({ parent: round_id });
    }
  };
  const detach = (round_id, puzzle_id) => {
    const puzz_cy_id = `puzzles_${puzzle_id}`;
    const puzz_node = this.cy.$id(puzz_cy_id);
    if (puzz_node != null && puzz_node.parent().id() === round_id) {
      puzz_node.move({ parent: null });
      this.structure = true;
    }
  };

  this.rounds = Rounds.find({}, { fields: { name: 1, puzzles: 1 } }).observe({
    added: (doc) => {
      startAdding();
      const id = `rounds_${doc._id}`;
      this.cy.add({
        group: "nodes",
        data: {
          id,
          label: doc.name,
        },
      });
      this.structure = true;
      this.roundChange = true;
      doc.puzzles.forEach((puzzle_id) => addOrMove(id, puzzle_id));
    },
    changed: (newDoc, oldDoc) => {
      let puzzle_id;
      startAdding();
      const id = `rounds_${newDoc._id}`;
      const oldPuzzles = new Set(oldDoc.puzzles);
      const newPuzzles = new Set(newDoc.puzzles);
      for (puzzle_id of newPuzzles) {
        if (oldPuzzles.has(puzzle_id)) {
          continue;
        }
        addOrMove(id, puzzle_id);
      }
      for (puzzle_id of oldPuzzles) {
        if (newPuzzles.has(puzzle_id)) {
          continue;
        }
        detach(id, puzzle_id);
      }
      if (oldDoc.name !== newDoc.name) {
        this.cy.$id(id).data("label", newDoc.name);
      }
    },
    removed: (doc) => {
      startAdding();
      const id = `rounds_${doc._id}`;
      for (let puzzle_id of doc.puzzles) {
        detach(id, puzzle_id);
      }
      this.cy.remove(`#${id}`);
      this.structure = true;
      this.roundChange = true;
    },
  });

  const setPuzzleData = (node, doc) => {
    node.data("label", abbrev(doc.name)).data("color", objectColor(doc));
    if (doc.puzzles != null) {
      if (!node.hasClass("meta")) {
        this.structure = true;
      }
      node.addClass("meta");
    } else {
      if (node.hasClass("meta")) {
        this.structure = true;
      }
      node.removeClass("meta");
    }
    if (doc.solved) {
      node.addClass("solved");
    } else {
      node.removeClass("solved");
    }
    if (isStuck(doc)) {
      node.addClass("stuck");
    } else {
      node.removeClass("stuck");
    }
  };

  const ensureNode = (_id) => {
    const id = `puzzles_${_id}`;
    let node = this.cy.$id(id);
    if (node.empty()) {
      this.structure = true;
      node = this.cy.add({
        group: "nodes",
        data: { id },
      });
    }
    return node;
  };
  const addNodeMetaEdge = (meta, node) => {
    const mn = ensureNode(meta);
    this.structure = true;
    this.cy.add({
      group: "edges",
      data: {
        source: node.data("id"),
        target: mn.data("id"),
      },
    });
  };

  this.puzzles = Puzzles.find(
    {},
    {
      fields: {
        name: 1,
        feedsInto: 1,
        puzzles: 1,
        solved: 1,
        "tags.color": 1,
        "tags.status": 1,
      },
    }
  ).observe({
    added: (doc) => {
      startAdding();
      const node = ensureNode(doc._id);
      setPuzzleData(node, doc);
      for (let meta of doc.feedsInto) {
        addNodeMetaEdge(meta, node);
      }
    },
    changed: (newDoc, oldDoc) => {
      let meta;
      startAdding();
      const node = ensureNode(newDoc._id);
      setPuzzleData(node, newDoc);
      const oldMetas = new Set(oldDoc.feedsInto);
      const newMetas = new Set(newDoc.feedsInto);
      for (meta of newMetas) {
        if (oldMetas.has(meta)) {
          continue;
        }
        addNodeMetaEdge(meta, node);
      }
      for (meta of oldMetas) {
        if (newMetas.has(meta)) {
          continue;
        }
        const id = `puzzles_${meta}`;
        this.structure = true;
        this.cy.remove(`edge[source=\"${node.data("id")}\"][target=\"${id}\"]`);
      }
    },
    removed: (doc) => {
      startAdding();
      this.cy.remove(`#puzzles_${doc._id}`);
      this.structure = true;
    },
  });
});
