import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
import { parse, HTMLElement } from "node-html-parser";
import iconv from "iconv-lite";

type Councilors = {
  title: string;
  progressUrl: string;
};

type Process = {
  presenter: string;
};

const loadHtml = async (url: string): Promise<string> => {
  const response = await fetch(url);

  const data = iconv.decode(
    Buffer.from(await response.arrayBuffer()),
    "shift_jis"
  );

  return data;
};

const parseRecord = (tr: HTMLElement): Councilors => {
  const dataList = tr.getElementsByTagName("td");

  return {
    title: dataList[2].getElementsByTagName("span")[0].childNodes[0].toString(),
    progressUrl: dataList[4]
      .getElementsByTagName("a")[0]
      .getAttribute("href") as string,
  };
};

const parseTable = (element: HTMLElement): Councilors[] | null => {
  const caption = element
    .getElementsByTagName("caption")[0]
    .childNodes[0].toString();

  switch (caption) {
    case "参法の一覧": {
      const recordElements = element.getElementsByTagName("tr").slice(1);
      return recordElements.map((tr) => parseRecord(tr));
    }
    default:
      return null;
  }
};

const parsePage = (root: HTMLElement): { councilors: Councilors[] } => {
  const target = root.getElementsByTagName("table");
  const councilors = target
    .map((t) => {
      return parseTable(t);
    })
    .filter((v): v is Councilors[] => !!v)[0];

  return {
    councilors,
  };
};

const parseProgressPage = (html: HTMLElement): Process => {
  const trElements = html
    .getElementsByTagName("tr")
    .filter(
      (tr) =>
        tr
          .getElementsByTagName("td")[0]
          ?.getElementsByTagName("span")[0]
          .childNodes[0].toString() == "議案提出者"
    );

  return {
    presenter: trElements[0]
      .getElementsByTagName("td")[1]
      .getElementsByTagName("span")[0]
      .childNodes[0].toString(),
  };
};

const main = async () => {
  const PAGE_URL =
    "https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/kaiji208.htm";

  const page = parsePage(parse(await loadHtml(PAGE_URL)));
  const d = await Promise.all(
    page.councilors.map((c) =>
      loadHtml(path.join(path.dirname(PAGE_URL), c.progressUrl)).then(
        (html) => ({
          presenter: parseProgressPage(parse(html)).presenter,
          title: c.title,
        })
      )
    )
  );
  d.map((d) => console.log(`"${d.presenter}", "${d.title}"`));
};

main();
