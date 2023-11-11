let actorData;

Hooks.on("init", () => {
  createActorJSON('init');
});

Hooks.on('updateActor', () => {
  if (!Hooks.call("actorViewerGenerate")) {
    createActorJSON('updateActor');
  }
});

Hooks.on('updateItem', () => {
  if (!Hooks.call("actorViewerGenerate")) {
    createActorJSON('updateItem');
  }
});

Hooks.on('createActiveEffect', () => {
  if (!Hooks.call("actorViewerGenerate")) {
    createActorJSON('createActiveEffect');
  }
});

Hooks.on('deleteActiveEffect', () => {
  if (!Hooks.call("actorViewerGenerate")) {
    createActorJSON('deleteActiveEffect');
  }
});

async function createActorJSON(hookName = '') {
  const inviteLinks = await getInviteLinks();
  if (game.system.id === "dnd5e") {
    Hooks.on("actorViewerGenerate", () => {
      const includeNPC = game.settings.get("actor-widgets", "includeNPC");
      let updateData = {};
      game.actors.forEach((actor) => {
        if (actor.type === "group" || actor.type === "vehicle" || actor.name.includes("Item Pile")) return;
        if (!includeNPC && actor.type === 'npc') return;
        if (!updateData[actor.id]) {
          updateData[actor.id] = {};
        }
        let spellData = [];
        updateData[actor.id] = actor.name ? { name: actor.name } : { name: 'John Doe' };

        if (game.user.isGM) {
          actor.setFlag("actor-widgets", "classLabels", actor.itemTypes.class.map((c) => c.name).join("/"));
        }

        if (hookName === 'createActiveEffect' || hookName === 'deleteActiveEffect' || hookName === 'init') {
          const firstStatus = actor.effects.find(eff => eff.statuses.size > 0 && eff.sourceName === actor.name) || { icon: '', name: '' };
          updateData[actor.id].status = firstStatus.icon === '' ? firstStatus : shrinkStatus(firstStatus);
        }

        if (hookName === 'updateItem' || hookName === 'init') {
          const weapon = actor.items.find(item => item.type === 'weapon' && item.system.equipped === true);
          const consumable = actor.items.find(item => item.type === 'consumable' && /healing/i.test(item.name));

          const actorWeapon = {
            name: weapon?.name || "unarmed",
            img: weapon?.img ? weapon.img : 'icons/weapons/fist/fist-knuckles-brass.webp',
            attackBonus: weapon?.system.attackBonus || '0',
          };

          const actorConsumable = {
            name: consumable?.name || 'empty',
            img: consumable?.img ? consumable.img : 'icons/svg/cancel.svg',
          };
          updateData[actor.id].weapon = actorWeapon;
          updateData[actor.id].consumable = actorConsumable;
        }

        const hmm = actor.system.spells;
        for (const spellName in hmm) {
          if (hmm.hasOwnProperty(spellName)) {
            const spellInfo = hmm[spellName];
            const spellSlotInfo = { name: spellName, value: spellInfo.value, max: spellInfo.max };
            if (spellSlotInfo.max <= 0) continue;
            spellData.push(spellSlotInfo);
          }
        }

        updateData[actor.id].id = actor.id;
        updateData[actor.id].worldID = game.world.id;
        updateData[actor.id].system = game.world.system;
        updateData[actor.id].img = actor.img;
        updateData[actor.id].inviteLinks = inviteLinks;
        updateData[actor.id].abilityScores = stripValuesFromAS(actor.system.abilities);
        updateData[actor.id].spellSlots = spellData;
        updateData[actor.id].race = actor.system.details.race;
        updateData[actor.id].ac = actor.system.attributes.ac.value || 0;
        updateData[actor.id].xp = actor.system.details.xp;
        updateData[actor.id].hp = { value: actor.system.attributes.hp.value, max: actor.system.attributes.hp.max };
        updateData[actor.id].level = actor.system.details.level || 1;
        updateData[actor.id].class = actor.flags["actor-widgets"]?.classLabels || "Classless";
      });

      // create json file
      actorData = Object.assign({}, actorData, updateData);
      ActorViewer.createActorsFile(actorData);

      ActorViewer.createWorldsFile();
      // set application button url
      game.settings.set("actor-widgets", "systemSite", "https://actor-widget-site-8099a1eac7b4.herokuapp.com/");

      return false;
    });
  }
}

function shrinkStatus(status) {
  let result = {};
  result.icon = status.icon;
  result.name = status.name;
  return result;
}

function stripValuesFromAS(asOBJ) {
  const reducedObject = {};

  for (const key in asOBJ) {
    if (asOBJ.hasOwnProperty(key)) {
      reducedObject[key] = { value: asOBJ[key].value };
    }
  }

  return reducedObject;
}

async function getInviteLinks() {
  let inviteLinks = new InvitationLinks();
  let inviteData = await inviteLinks.getData();
  return { local: inviteData.local, remote: inviteData.remote };
}