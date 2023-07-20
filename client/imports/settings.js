import { reactiveLocalStorage } from "./storage.js";

class Setting {
  constructor(name, helper) {
    this.name = name;
    if (helper == null) {
      helper = this.name;
    }
    Template.registerHelper(helper, () => this.get());
  }

  set(value) {
    return reactiveLocalStorage.setItem(this.name, value);
  }
}

class DefaultFalseSetting extends Setting {
  get() {
    return "true" === reactiveLocalStorage.getItem(this.name);
  }
}

export const CAP_JITSI_HEIGHT = new DefaultFalseSetting(
  "capJitsiHeight",
  "jitsiHeightCapped"
);
export const HIDE_SOLVED = new DefaultFalseSetting("hideSolved");
export const HIDE_SOLVED_FAVES = new DefaultFalseSetting("hideSolvedFaves");
export const HIDE_SOLVED_METAS = new DefaultFalseSetting("hideSolvedMeta");
export const STUCK_TO_TOP = new DefaultFalseSetting("stuckToTop");
export const HIDE_USELESS_BOT_MESSAGES = new DefaultFalseSetting(
  "nobot",
  "noBot"
);
export const MUTE_SOUND_EFFECTS = new DefaultFalseSetting("mute", "sfxMute");
export const HIDE_OLD_PRESENCE = new DefaultFalseSetting("hideOldPresence");
export const LESS_COLORFUL = new DefaultFalseSetting("boringMode");
export const SORT_REVERSE = new DefaultFalseSetting("sortReverse");
export const EXPERT_MODE = new DefaultFalseSetting("expertMode");

class DefaultTrueSetting extends Setting {
  get() {
    return "false" !== reactiveLocalStorage.getItem(this.name);
  }
}

export const START_VIDEO_MUTED = new DefaultTrueSetting("startVideoMuted");
export var START_AUDIO_MUTED = new DefaultTrueSetting("startAudioMuted");
export const FIRST_LOGIN = new DefaultTrueSetting("firstLogin");

const darkModeDefault = (function () {
  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const res = new ReactiveVar(darkModeQuery.matches);
  darkModeQuery.addEventListener("change", (e) => res.set(e.matches));
  return res;
})();

class DarkModeSetting extends Setting {
  get() {
    const darkModeOverride = reactiveLocalStorage.getItem(this.name);
    if (darkModeOverride != null) {
      return darkModeOverride === "true";
    }
    return darkModeDefault.get();
  }
}

export const DARK_MODE = new DarkModeSetting("darkMode");

class CompactModeSetting extends Setting {
  get() {
    const editing = Meteor.userId() && Session.get("canEdit");
    return "true" === reactiveLocalStorage.getItem(this.name) && !editing;
  }
}

export const COMPACT_MODE = new CompactModeSetting("compactMode");

const currentColumns = new ReactiveVar(Object.freeze([]));
const visibleColumns = new ReactiveVar(Object.freeze([]));
const visibleColumnsForHelper = new ReactiveVar(Object.freeze([]));
const visibleColumnsWhenEditing = new Set(["answer", "status"]);

Tracker.autorun(function () {
  const cols = reactiveLocalStorage.getItem("currentColumns");
  const col_array =
    cols != null ? cols.split(",") : ["answer", "status", "working", "update"];
  currentColumns.set(Object.freeze(col_array));
});

class CurrentColumnsSetting extends Setting {
  get() {
    return currentColumns.get();
  }
  set(val) {
    super.set(val.join(","));
  }
}

export const CURRENT_COLUMNS = new CurrentColumnsSetting("currentColumns");

Tracker.autorun(function () {
  const visible_array = COMPACT_MODE.get()
    ? Object.freeze(["answer"])
    : Meteor.userId() && Session.get("canEdit")
    ? currentColumns.get().filter((x) => visibleColumnsWhenEditing.has(x))
    : currentColumns.get();
  return visibleColumns.set(Object.freeze(visible_array));
});

export const VISIBLE_COLUMNS = {
  get() {
    return visibleColumns.get();
  },
};

Tracker.autorun(() =>
  visibleColumnsForHelper.set(
    Object.freeze(
      visibleColumns.get().map((x) => ({
        _id: x,
      }))
    )
  )
);

Template.registerHelper("nCols", () => 1 + visibleColumns.get().length);

// If iterating over a list without _id fields, the key is index, which makes insertions render oddly.
Template.registerHelper("visibleColumns", () => visibleColumnsForHelper.get());
