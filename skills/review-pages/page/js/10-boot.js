// Start: load the review, build everything, show the overview, then connect the database.
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
}
boot();
