import SilentFilePicker from "./customFilepickers/foundryFilePicker.js";

let filePath = window.location.href.replace("/game", "");

Hooks.once("init", () => {
  game.settings.register("actor-widgets", "systemSite", {
    scope: "client",
    type: String,
    default: "https://actor-widget-site-8099a1eac7b4.herokuapp.com/",
    config: false,
  });
  game.settings.register("actor-widgets", "includeNPC", {
    scope: "world",
    type: Boolean,
    default: false,
    config: true,
    name: "Include NPCs",
    hint:
      "Check this if you want to include NPCs.",
  })
});

Hooks.once("setup", async () => {
  await FilePicker.createDirectory("data", "actorAPI", {}).catch(() => { });

  const hookNotExecuted = Hooks.call("actorViewerGenerate");

  if (hookNotExecuted) {
    console.warn("ActorViewer | No settings found for this system.");

    let actors = {};
    game.actors.forEach((actor) => {
      const includeNPC = game.settings.get("actor-widgets", "includeNPC");
      if (!includeNPC && actor.type === 'npc') return;
      let items = [];

      if (game.user.isGM) {
        actor.setFlag("actor-widgets", "classLabels", actor.itemTypes.class.map((c) => c.name).join(", "));
      }

      actor.items.forEach((item) => {
        if (game.user.isGM) {
          item.setFlag("actor-widgets", "labels", item.labels);
        }
        items.push(item.system);
      });

      actors[actor.id] = JSON.parse(JSON.stringify(actor.system));
      actors[actor.id].items = JSON.parse(JSON.stringify(items));
      actors[actor.id].name = JSON.parse(JSON.stringify(actor.name));

    });

    // create json files
    ActorViewer.createActorsFile(actors);
    ActorViewer.createWorldsFile();
    // set application button url
    game.settings.set("actor-widgets", "systemSite", "https://actor-widget-site-8099a1eac7b4.herokuapp.com/");
  }
});

Hooks.on("renderActorSheet", async (sheet, html) => {
  jQuery('<a class="character-id"><i class="fas fa-link"></i>Widgets</a>').insertAfter(html.find(".window-title"));
  const inviteLinks = await getInviteLinks();

  html.find(".character-id").on("click", () => {
    if (filePath.includes("https://")) {
      new CopyPopupApplication(filePath + sheet.actor.id).render(true);
    } else {
      new CopyPopupApplication(inviteLinks.remote).render(true);
    }
  });
});

class CopyPopupApplication extends Application {
  constructor (url, options = {}) {
    super(options);

    this.url = url;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "copyPopup",
      title: game.i18n.localize("actorWidgets.widgetSite"),
      template: "modules/actor-widgets/templates/copyPopup.html",
      classes: ["copy-url-window"],
      resizable: false,
    });
  }

  getData() {
    return {
      url: this.url,
    };
  }

  /**
   * @param  {JQuery} html
   */
  async activateListeners(html) {
    super.activateListeners(html);
    const inviteLinks = await getInviteLinks();

    html.find(".close").on("click", () => {
      this.close();
    });
    html.find(".sendToApp").on("click", () => {
      Object.assign(document.createElement("a"), { target: "_blank", href: game.settings.get("actor-widgets", "systemSite") + "?remote_url=" + inviteLinks.remote  }).click();
    });
    html.find(".copyButton").on("click", () => {
      copyToClipboard(this.url);
    });
  }
}

/**
 * @param  {String} fileName
 * @param  {String} worldName
 * @param  {String} content
 */
async function createJsonFile(fileName, content) {
  const file = new File([content], fileName, { type: "application/json", lastModified: Date.now() });

  let response = await upload("data", "actorAPI", file, {});
  filePath = response.path;
}

function copyToClipboard(text) {
  const listener = function (ev) {
    ev.preventDefault();
    ev.clipboardData.setData("text/plain", text);
  };
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
  ui.notifications.info(game.i18n.localize("actorWidgets.copied"));
}
/**
 * @param  {Actor[]} actors
 */
function createActorsFile(actors) {
  createJsonFile(`actors-list.json`, JSON.stringify(actors));
}

/**
 * Create or update the worlds.json file
 */
function createWorldsFile() {
  let worlds = [];
  const world = { 'name': game.world.id, 'title': game.world.title, 'system': game.world.system };
  console.debug('ActorViewer |', 'Checking for existing worlds.json');
  fetch(`${window.location.href.replace("/game", "")}/actorAPI/worlds.json`)
    .then((response) => response.json())
    .then((data) => {
      console.debug('ActorViewer |', 'Existing worlds.json data', data);
      worlds = data;
      if (!worlds.some(w => w.name === game.world.id)) {
        worlds.push(world);
        console.debug('ActorViewer |', 'Writing data to worlds.json', worlds);
        createJsonFile('worlds.json', JSON.stringify(worlds));
      }
    })
    .catch(() => {
      console.debug('ActorViewer |', 'Creating worlds.json');
      worlds.push(world);
      console.debug('ActorViewer |', 'Writing data to existing worlds.json', worlds);
      createJsonFile('worlds.json', JSON.stringify(worlds));
    });
}

/**
 * @type {FilePicker.upload}
 *
 * @returns {Promise}
 */
async function upload(source, path, file, options) {
  return await SilentFilePicker.upload(source, path, file, options);
}

async function getInviteLinks() {
  let inviteLinks = new InvitationLinks();
  let inviteData = await inviteLinks.getData();
  return { local: inviteData.local, remote: inviteData.remote };
}

globalThis.ActorViewer = {
  createActorsFile: createActorsFile,
  createWorldsFile: createWorldsFile,
  copyToClipboard: copyToClipboard,
};

