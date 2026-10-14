import { expect, test } from "@playwright/test";

test("an overview bookmark opens Atlas Explorer browse and drops score filters", async ({
  page,
}) => {
  await page.goto("/overview?dataset=alpha-explorer&county=06085&eco=70");
  await expect(page).toHaveURL(/\/explore/);
  const url = new URL(page.url());
  expect({
    county: url.searchParams.get("county"),
    dataset: url.searchParams.get("dataset"),
    eco: url.searchParams.get("eco"),
    mode: url.searchParams.get("mode"),
    pathname: url.pathname,
  }).toEqual({
    county: "06085",
    dataset: "alpha-explorer",
    eco: null,
    mode: null,
    pathname: "/explore",
  });
  expect(url.hash).toBe("");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Explore the evidence behind every county.",
    })
  ).toBeVisible();
});

test("a geographic explorer bookmark opens browse and does not invent a county", async ({
  page,
}) => {
  await page.goto(
    "/geographic_explorer?view=compare&selected=06085%2C06037&county=06085&metric=score"
  );
  await expect(page).toHaveURL(/\/explore/);
  const url = new URL(page.url());
  expect(url.searchParams.get("view")).toBeNull();
  expect(url.searchParams.get("metric")).toBeNull();
  expect(url.searchParams.get("county")).not.toBe("06037");
  expect(url.searchParams.get("mode")).toBeNull();

  await page.goto("/geographic_explorer?county=99999");
  await expect(page).toHaveURL(/\/explore/);
  expect(new URL(page.url()).searchParams.get("county")).toBe("99999");
  expect(new URL(page.url()).searchParams.get("county")).not.toBe("06037");
});

test("a legacy analytical root URL opens Atlas Explorer and drops unsupported filters", async ({
  page,
}) => {
  await page.goto("/?county=08001&state=CO&dataset=alpha-explorer&eco=70");
  await expect(page).toHaveURL(/\/explore/);
  const url = new URL(page.url());
  expect({
    county: url.searchParams.get("county"),
    dataset: url.searchParams.get("dataset"),
    eco: url.searchParams.get("eco"),
    pathname: url.pathname,
    scope: url.searchParams.get("scope"),
    state: url.searchParams.get("state"),
  }).toEqual({
    county: "08001",
    dataset: "alpha-explorer",
    eco: null,
    pathname: "/explore",
    scope: "CO",
    state: null,
  });
  await expect(
    page.getByRole("heading", {
      name: "Connect the data. See the bigger picture.",
    })
  ).toHaveCount(0);
});

test("drops a legacy root section hash and keeps the Front Porch story anchor", async ({
  page,
}) => {
  await page.goto("/#atlas");
  await expect(page).toHaveURL(/\/explore/);
  expect(new URL(page.url()).pathname).toBe("/explore");
  expect(new URL(page.url()).search).toBe("");

  await page.goto("/#methods");
  await expect(page).toHaveURL(/\/explore/);
  expect(new URL(page.url()).search).toBe("");

  await page.goto("/#front-porch-story");
  await expect(page).toHaveURL(/\/#front-porch-story$/);
  await expect(
    page.getByRole("heading", {
      name: "Connect the data. See the bigger picture.",
    })
  ).toBeVisible();
});
