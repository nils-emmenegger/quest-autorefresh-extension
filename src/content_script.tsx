async function sleep(secs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

function getMain(): HTMLElement {
  const main = document.getElementById("PT_MAIN");

  if (!main) {
    throw new Error("Could not find PT_MAIN");
  }

  return main;
}

async function getIFrameDocument(main: HTMLElement): Promise<Document> {
  const iframe = await new Promise<HTMLElement | null>((resolve) => {
    const iframe = document.getElementById("main_target_win0");

    if (iframe) {
      resolve(iframe);
      return;
    }

    const observer = new MutationObserver((_mutations, observer) => {
      const iframe = document.getElementById("main_target_win0");
      resolve(iframe);
      observer.disconnect();
    });

    observer.observe(main, { attributes: true, childList: true, subtree: true });
  });

  if (!(iframe instanceof HTMLIFrameElement)) {
    throw new Error("Could not find iframe");
  }

  const doc = await new Promise<Document | null>((resolve) => {
    const doc = iframe.contentDocument;

    if (doc?.body.hasChildNodes()) {
      resolve(doc);
      return;
    }

    const iframeListener = () => {
      resolve(iframe.contentDocument);
      iframe.removeEventListener("load", iframeListener);
    };

    iframe.addEventListener("load", iframeListener);
  });

  if (!doc) {
    throw new Error("Could not access iframe contentDocument");
  }

  return doc;
}

async function clickShoppingCart(main: HTMLElement, doc: Document): Promise<Document> {
  const shoppingCartFilter = Array.from(doc.getElementsByTagName("a")).filter((a) => a.textContent === "Shopping Cart");

  if (shoppingCartFilter.length !== 1) {
    throw new Error("Expected 1 Shopping Cart, found " + shoppingCartFilter.length);
  }

  const shoppingCart = shoppingCartFilter[0];
  shoppingCart.click();

  await sleep(1);
  return await getIFrameDocument(main);
}

async function proceedToShoppingCart(main: HTMLElement, doc: Document): Promise<Document> {
  const radioButtons = doc.querySelectorAll("input.PSRADIOBUTTON");
  if (radioButtons.length === 0) {
    throw new Error("Could not find radio buttons");
  }
  const lastRadioButton = radioButtons[radioButtons.length - 1] as HTMLInputElement;
  lastRadioButton.click();

  const continueButton = doc.getElementById("DERIVED_SSS_SCT_SSR_PB_GO") as HTMLInputElement | null;
  if (!continueButton) {
    throw new Error("Could not find continue button");
  }
  continueButton.click();

  await sleep(1);
  return await getIFrameDocument(main);
}

type ClassData = {
  name: string;
  status: "Closed" | "Open";
}

type ClassGroupData = {
  lec: ClassData;
  other: ClassData[];
}

function parseShoppingCartRows(rows: HTMLCollectionOf<HTMLTableRowElement>): ClassGroupData[] {
  const ret: ClassGroupData[] = [];

  const buf: ClassData[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const name = row.cells[1].textContent?.trim().replace("\n", "");
    if (!name) {
      throw new Error("Could not parse class name");
    }

    const status = row.cells[6].getElementsByTagName("img")[0]?.alt;
    if (status !== "Open" && status !== "Closed") {
      throw new Error("Could not parse class status");
    }

    if (row.cells[0].getElementsByTagName("input").length > 0 && buf.length > 0) {
      ret.push({
        lec: buf[0],
        other: buf.slice(1)
      });

      buf.length = 0;
    }

    buf.push({
      name,
      status
    });
  }

  if (buf.length !== 0) {
    ret.push({
      lec: buf[0],
      other: buf.slice(1)
    })
  }

  return ret;
}

function checkShoppingCart(doc: Document): ClassGroupData[] {
  const table = doc.getElementById("SSR_REGFORM_VW$scroll$0");
  if (!table) {
    throw new Error("Could not find table");
  }

  const innerTable = table.getElementsByClassName("PSLEVEL1GRID")[0];
  if (!innerTable) {
    throw new Error("Could not find inner table");
  }

  const rawRows = innerTable.getElementsByTagName("tr");
  return parseShoppingCartRows(rawRows);
}

let running = false;
async function loopUntilClassAvailable(delay_secs: number): Promise<ClassGroupData[]> {
  const main = getMain();
  let doc = await getIFrameDocument(main);

  doc = await clickShoppingCart(main, doc);

  while (true) {
    doc = await proceedToShoppingCart(main, doc);
    const classGroupData = checkShoppingCart(doc);
    const availableClasses = classGroupData.filter(classGroup => classGroup.lec.status === "Open");
    if (availableClasses.length > 0) {
      return availableClasses;
    }
    await sleep(delay_secs);
    if (!running) {
      throw new Error("Stopped by user");
    }
    doc = await clickShoppingCart(main, doc);
  }
}

function sendAvailableClassesNotification(availableClasses: ClassGroupData[]): void {
  chrome.runtime.sendMessage({
    from: "content_script",
    type: "available_classes",
    availableClasses
  });
}

function sendErrorNotification(error: any): void {
  chrome.runtime.sendMessage({
    from: "content_script",
    type: "error",
    errorName: error?.name,
    errorMessage: error?.message
  });
}

async function main() {
  try {
    const availableClasses = await loopUntilClassAvailable(60);
    sendAvailableClassesNotification(availableClasses);
  } catch (error) {
    sendErrorNotification(error);
  }
}

chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (msg.from === "popup") {
    if (msg.action === "Start") {
      if (running) {
        return;
      }
      running = true;
      await main();
      running = false;
    } else if (msg.action === "Stop") {
      running = false;
    } else if (msg.action === "IsRunning") {
      sendResponse({ running });
    }
  }
});
