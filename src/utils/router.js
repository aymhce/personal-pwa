let views = {
  home: null,
  daysSince: null,
  tech: null
};

export function initRouter(nextViews) {
  views = nextViews;
}

export function showView(name) {
  Object.values(views).forEach((v) => v?.classList.add("hidden"));
  views[name]?.classList.remove("hidden");
}
