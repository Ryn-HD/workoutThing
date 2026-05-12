import { test, expect } from "@playwright/test";
import {
  startpage,
  PlaywrightUtils_clearCodeMirror,
  PlaywrightUtils_createProgram,
  PlaywrightUtils_disableTours,
  PlaywrightUtils_typeCodeMirror,
  PlaywrightUtils_typeKeyboard,
} from "./playwrightUtils";

test("Bodyweight exercises allow blank added load", async ({ page }) => {
  await page.goto(startpage + "?skipintro=1&nosync=true");
  await PlaywrightUtils_disableTours(page);
  await PlaywrightUtils_createProgram(page, "My Program");

  await page.getByTestId("tab-edit").click();
  await page.getByTestId("editor-v2-full-program").click();
  await PlaywrightUtils_clearCodeMirror(page, "planner-editor");
  await PlaywrightUtils_typeCodeMirror(
    page,
    "planner-editor",
    `# Week 1
## Day 1
Chin Up / 2x5 / warmup: none
`
  );

  await page.getByTestId("save-program").click();

  await page.getByTestId("footer-workout").click();
  await page.getByTestId("start-workout").click();

  await expect(page.getByTestId("entry-chin-up").getByTestId("input-set-weight-field").nth(0)).toContainText("+ load");
  await page.getByTestId("entry-chin-up").getByTestId("complete-set").nth(0).click();
  await expect(page.getByTestId("modal-amrap-input")).toHaveCount(0);

  await PlaywrightUtils_typeKeyboard(
    page,
    page.getByTestId("entry-chin-up").getByTestId("input-set-weight-field").nth(1),
    "5"
  );
  await page.getByTestId("entry-chin-up").getByTestId("complete-set").nth(1).click();

  await page.getByTestId("finish-workout").click();
  await page.getByTestId("finish-day-continue").click();

  const chinUpHistory = page.getByTestId("history-record").nth(1).getByTestId("history-entry-exercise").nth(0);
  await expect(chinUpHistory.getByTestId("history-entry-weight")).toContainText("5");
  await expect(chinUpHistory).not.toContainText("0lb");
});

test("Clearing bodyweight added load records bodyweight only even when target has added load", async ({ page }) => {
  await page.goto(startpage + "?skipintro=1&nosync=true");
  await PlaywrightUtils_disableTours(page);
  await PlaywrightUtils_createProgram(page, "My Program");

  await page.getByTestId("tab-edit").click();
  await page.getByTestId("editor-v2-full-program").click();
  await PlaywrightUtils_clearCodeMirror(page, "planner-editor");
  await PlaywrightUtils_typeCodeMirror(
    page,
    "planner-editor",
    `# Week 1
## Day 1
Reverse Crunch / 1x12 / 5lb / warmup: none
`
  );

  await page.getByTestId("save-program").click();

  await page.getByTestId("footer-workout").click();
  await page.getByTestId("start-workout").click();

  const reverseCrunch = page.getByTestId("entry-reverse-crunch");
  const weightField = reverseCrunch.getByTestId("input-set-weight-field").nth(0);
  await expect(weightField).toContainText("5");
  await weightField.click();
  await page.getByTestId("keyboard-backspace").click();
  await page.getByTestId("keyboard-close").click();
  await expect(weightField).toContainText("+ load");

  await PlaywrightUtils_typeKeyboard(page, reverseCrunch.getByTestId("input-set-reps-field").nth(0), "3");
  await reverseCrunch.getByTestId("complete-set").nth(0).click();

  await page.getByTestId("finish-workout").click();
  await page.getByTestId("finish-day-continue").click();

  const reverseCrunchHistory = page.getByTestId("history-record").nth(1).getByTestId("history-entry-exercise").nth(0);
  await expect(reverseCrunchHistory).toContainText("3");
  await expect(reverseCrunchHistory).not.toContainText("5lb");
});
