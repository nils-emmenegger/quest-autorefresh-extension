import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [buttonText, setButtonText] = useState<"Start" | "Stop">("Start");

  const handleClick = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      return;
    }

    const newButtonText = buttonText === "Start" ? "Stop" : "Start";
    try {
      await chrome.tabs.sendMessage(tabId, { from: "popup", action: buttonText });
      setButtonText(newButtonText);
    } catch (e) {
    }
  };

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (!tabId) {
        return;
      }

      try {
        const response: any = await chrome.tabs.sendMessage(tabId, { from: "popup", action: "IsRunning" });
        if (response?.running === undefined) {
          return;
        }
        setButtonText(response.running ? "Stop" : "Start");
      } catch (e) {
      }
    })()
  }, [])

  return (
    <>
      <button onClick={handleClick}>{buttonText}</button>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
