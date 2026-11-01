// Start: load the review, build everything, show the overview, then connect the database and the viewer.
import { $ } from "./01-core.js";
import { loadReview, prepare } from "./02-data.js";
import { connectDb, loadTicks, repaintTicks } from "./03-ticks.js";
import { initComposer } from "./04-diff.js";
import { watchGroups } from "./04-groups.js";
import { initTree, initTreeState, renderTree } from "./05-tree.js";
import { initGroupState, initOrder, renderOrder } from "./06-order.js";
import { initOverview, renderOverview } from "./07-overview.js";
import { buildFind, initFind } from "./08-find.js";
import { applyScreens, initNav } from "./09-nav.js";
import { connectBridge } from "./10-bridge.js";

async function boot() {
  let R;
  try {
    R = await loadReview();
  } catch (e) {
    $("ov-title").textContent = `The review data did not load (${e.message}). Reload to try again.`;
    return;
  }
  prepare(R);
  loadTicks();
  initTreeState();
  initGroupState();
  initComposer();
  watchGroups();
  initTree();
  initOrder();
  initFind();
  initOverview();
  initNav();
  renderOverview();
  renderTree();
  renderOrder();
  buildFind();
  repaintTicks();
  applyScreens();
  connectDb();
  connectBridge();
}
boot();
