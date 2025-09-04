chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.from === "content_script") {
    if (msg.type === "available_classes") {
      const availableClasses = msg.availableClasses as ClassGroupData[];
      await chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: "Classes Available",
        message: `${availableClasses.map((c) => c.lec.name).join(", ")}`,
      });
    } else if (msg.type === "error") {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: "Error",
        message: `${msg.errorName}: ${msg.errorMessage}`,
      });
    }
  }
});
