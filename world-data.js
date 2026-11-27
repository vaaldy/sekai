// Versioned creative inventory and world data. Coordinates and asset sizes are logical pixels.
const terrain = "assets/terrain/";
export const sekaiAssetCatalog = {
  "background.mountain": { path: "assets/mountain-wide.png", size: [640,250], transparent: false },
  "background.mountain-day": { path: "assets/mountain-wide-day.png", size: [640,250], transparent: false },
  "background.mountain-original": { path: "assets/mountain.png", size: [320,180], transparent: false },
  "character.original": { path: "assets/character.png", size: [16,24], transparent: true },
  "atmosphere.mist": { path: "assets/forest-mist.png", size: [660,88], transparent: true },
  "terrain.snow-stone": { path: terrain+"snow-stone.png", size: [32,5], transparent: false, tile: true },
  "terrain.timber": { path: terrain+"timber.png", size: [32,5], transparent: false, tile: true },
  "terrain.dirt-ground": { path: terrain+"dirt-ground.png", size: [64,14], transparent: false, tile: true },
  "building.cottage": { path: terrain+"cottage.png", size: [244,146], transparent: true },
  "furniture.workbench": { path: terrain+"workbench.png", size: [37,24], transparent: true },
  "furniture.bookshelf": { path: terrain+"bookshelf.png", size: [24,30], transparent: true },
  "building.railing": { path: terrain+"railing.png", size: [70,17], transparent: true },
  "portal.workspaces": { path: terrain+"spaces.png", size: [20,18], transparent: true },
  "portal.agents": { path: terrain+"tabs.png", size: [20,18], transparent: true },
  "portal.git": { path: terrain+"changes.png", size: [20,18], transparent: true },
  "portal.files": { path: terrain+"files.png", size: [20,18], transparent: true },
  "portal.command": { path: terrain+"command-block.png", size: [20,18], transparent: true },
  "portal.chest": { path: terrain+"storage-chest.png", size: [20,18], transparent: true },
  "item.blade": { path: terrain+"item-blade.png", size: [12,12], transparent: true },
  "item.lantern": { path: terrain+"item-lantern.png", size: [12,12], transparent: true },
  "item.feather": { path: terrain+"item-feather.png", size: [12,12], transparent: true },
  "item.cloak": { path: terrain+"item-cloak.png", size: [12,12], transparent: true },
  "item.pickaxe": { path: terrain+"item-pickaxe.png", size: [12,12], transparent: true },
  "item.timber": { path: terrain+"item-timber.png", size: [12,12], transparent: true },
  "item.stone": { path: terrain+"item-stone.png", size: [12,12], transparent: true },
  "item.berry": { path: terrain+"item-berry.png", size: [12,12], transparent: true },
};
export const sekaiFrames = { idle: 1, run: 4, jump: 2, fall: 2, dash: 2 };
for (const [pose,count] of Object.entries(sekaiFrames)) for (const side of ["left","right"]) for (let frame=0;frame<count;frame++) {
  sekaiAssetCatalog[`character.default.${pose}.${side}.${frame}`] = { path: `assets/characters/default/${pose}/${side}-${frame}.png`, size:[16,24], transparent:true };
}

for (const side of ["left","right"]) for (let frame=0;frame<4;frame++) {
  sekaiAssetCatalog[`building.door.${side}.${frame}`] = { path: `${terrain}door-${side}-${frame}.png`, size:[9,25], transparent:true };
}
for (const period of ["dawn","day","dusk","night"]) for (let frame=0;frame<2;frame++) {
  sekaiAssetCatalog[`wildlife.bird.${period}.${frame}`] = { path: `${terrain}bird-${period}-${frame}.png`, size:[14,10], transparent:true };
}
for (const kind of ["swing","pick"]) for (const side of ["left","right"]) for (let frame=0;frame<4;frame++) {
  sekaiAssetCatalog[`fx.${kind}.${side}.${frame}`] = { path: `${terrain}${kind}-${side}-${frame}.png`, size:[24,24], transparent:true };
}

const ledge = (id,a,b,y,asset="terrain.snow-stone",h=5) => ({id,kind:"platform",asset,x:a,y,w:b-a,h,collision:"one-way"});
const decoration = (id,asset,x,y,w,h) => ({id,kind:"decoration",asset,x,y,w,h,collision:"none"});
const door = (id,side,x,y) => ({id,kind:"decoration",asset:`building.door.${side}.0`,frames:[0,1,2,3].map(i=>`building.door.${side}.${i}`),x,y,w:9,h:25,collision:"none"});
const portal = (id,asset,title,action,x,y) => ({id,kind:"portal",asset,title,action,x:x-10,y:y-18,w:20,h:18,collision:"none"});
export const sekaiWorldDefinition = {
  version: 1, id: "mountain-village", size: [960,360], viewport: [320,180], spawn: [480,346], floor: 346,
  background: { asset: "background.mountain", dayAsset: "background.mountain-day", parallax: [.5,.38] },
  atmosphere: { mist: "atmosphere.mist" },
  vista: { id:"cottage-balcony", x:755, y:238, w:70, tolerance:5, zoom:.73, target:[650,220] },
  objects: [
    ledge("ground",0,960,346,"terrain.dirt-ground",14), ledge("central-low",445,505,310), ledge("central-left",384,437,277), ledge("cottage-approach",498,524,290),
    ledge("central-west",332,397,244), ledge("central-high",459,494,242), ledge("central-west-high",371,432,202), ledge("cottage-roof-left",535,558,202),
    ledge("west-low",236,312,309), ledge("west-gap",168,219,274), ledge("west-mid",258,296,240), ledge("west-high",302,349,202), ledge("west-ridge",225,276,166),
    ledge("west-shelf",136,192,140), ledge("west-peak-low",75,112,105), ledge("west-peak",151,203,72),
    ledge("cottage-workshop",550,755,310,"terrain.timber"), ledge("cottage-balcony",690,825,238,"terrain.timber"),
    ledge("east-low",830,886,282), ledge("east-mid",855,913,204), ledge("east-ridge",848,903,169), ledge("east-high",780,815,128), ledge("east-peak-low",700,754,93), ledge("east-peak",608,661,64), ledge("summit",510,564,37),
    ledge("summit-left",442,479,78), ledge("ridge-left",390,428,119), ledge("ridge-center",456,503,159), ledge("ridge-east",505,543,123),
    decoration("cottage-shell","building.cottage",527,200,244,146),
    door("cottage-door-left","left",538,318),
    door("cottage-door-right","right",744,318),
    decoration("workshop-bench","furniture.workbench",618,286,37,24),
    decoration("library-bookshelf","furniture.bookshelf",616,316,24,30),
    decoration("balcony-railing","building.railing",755,221,70,17),
    portal("workspace-portal","portal.workspaces","WORKSPACES","spaces",565,346),
    portal("file-library","portal.files","FILES","files",628,346),
    portal("agent-chest","portal.agents","TABS / AGENTS","tabs",690,346),
    portal("cottage-stash","portal.chest","STASH","chest",580,310),
    portal("git-workshop","portal.git","GIT","changes",690,310),
    portal("command-block","portal.command","COMMAND","command",800,346),
  ]
};

export function validateSekaiWorld(definition, catalog = sekaiAssetCatalog) {
  const fail = message => { throw new Error(`Invalid Sekai world: ${message}`); };
  const pair = v => Array.isArray(v) && v.length===2 && v.every(Number.isFinite);
  if (definition.version !== 1 || !pair(definition.size) || !definition.size.every(n=>n>0)) fail("version or size");
  const [width,height] = definition.size;
  if (!pair(definition.viewport) || definition.viewport.some((n,i)=>n<=0 || n>definition.size[i])) fail("viewport");
  if (!pair(definition.spawn) || definition.spawn.some((n,i)=>n<0 || n>definition.size[i]) || !Number.isFinite(definition.floor) || definition.floor<0 || definition.floor>height) fail("spawn or floor");
  if (!Array.isArray(definition.objects)) fail("objects");
  const ids = new Set();
  for (const object of definition.objects) {
    if (!object.id || ids.has(object.id)) fail(`duplicate or missing object id: ${object.id}`);
    ids.add(object.id);
    const asset = catalog[object.asset];
    if (!asset || !asset.path || !Array.isArray(asset.size) || asset.size.length!==2 || !asset.size.every(n=>Number.isFinite(n)&&n>0) || typeof asset.transparent!=="boolean") fail(`asset: ${object.asset}`);
    if (![object.x,object.y,object.w,object.h].every(Number.isFinite) || object.x<0 || object.y<0 || object.w<=0 || object.h<=0 || object.x+object.w>width || object.y+object.h>height) fail(`bounds: ${object.id}`);
    if (object.kind === "platform") { if (object.collision!=="one-way" || !asset.tile) fail(`platform: ${object.id}`); }
    else if (object.kind === "portal") { if (object.collision!=="none" || !["spaces","tabs","changes","files","command","chest"].includes(object.action) || !object.title) fail(`portal: ${object.id}`); }
    else if (object.kind !== "decoration" || object.collision !== "none") fail(`kind or collision: ${object.id}`);
    if (object.frames !== undefined && (!Array.isArray(object.frames) || !object.frames.length || object.frames.some(id=>!catalog[id]))) fail(`frames: ${object.id}`);
  }
  for (const object of definition.objects.filter(o=>o.kind==="portal")) {
    const x=object.x+object.w/2,y=object.y+object.h;
    if (!definition.objects.some(o=>o.kind==="platform" && o.y===y && o.x<=x && o.x+o.w>=x)) fail(`unsupported portal: ${object.id}`);
  }
  if (!catalog[definition.background?.asset] || (definition.background?.dayAsset && !catalog[definition.background.dayAsset]) || !pair(definition.background?.parallax) || definition.background.parallax.some(n=>n<0 || n>1) || !catalog[definition.atmosphere?.mist]) fail("environment asset or parallax");
  const v = definition.vista;
  if (!v || ![v.x,v.y,v.w,v.tolerance,v.zoom].every(Number.isFinite) || v.x<0 || v.y<0 || v.w<=0 || v.x+v.w>width || v.y>height || v.tolerance<0 || v.zoom<=0 || v.zoom>1 || !pair(v.target)) fail("vista");
  return definition;
}

export function sekaiAssetPath(id) { return `mods/sekai/${sekaiAssetCatalog[id].path}`; }
