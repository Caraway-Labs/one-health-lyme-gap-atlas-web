import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AtlasFilters } from "../src/components/atlas-filters";
import { ResultsTable } from "../src/components/results-table";

const metadata = { states: [{ code: "CO", name: "Colorado" }] } as never;
const county = { fips: "08001", county: "Adams", state: "CO", score: { score: 61.9 }, priority: "Review" } as never;

describe("Atlas shared controls", () => {
  it("updates state, query, evidence, and download through shared filter controls", () => {
    const onStateChange = vi.fn();
    const onQueryChange = vi.fn();
    const onEvidenceChange = vi.fn();
    const onDownload = vi.fn();
    render(<AtlasFilters metadata={metadata} stateFilter="ALL" query="" evidence="all" onStateChange={onStateChange} onQueryChange={onQueryChange} onEvidenceChange={onEvidenceChange} onDownload={onDownload} />);

    fireEvent.click(screen.getByRole("combobox", { name: "State" }));
    fireEvent.pointerDown(screen.getByText("Colorado"), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByText("Colorado"), { button: 0, pointerId: 1 });
    fireEvent.click(screen.getByText("Colorado"));
    fireEvent.change(screen.getByRole("textbox", { name: "County name or FIPS code" }), { target: { value: "Adams" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Filter counties by available data" }));
    fireEvent.pointerDown(screen.getByText("Published Lyme case count available"), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(screen.getByText("Published Lyme case count available"), { button: 0, pointerId: 1 });
    fireEvent.click(screen.getByText("Published Lyme case count available"));
    fireEvent.click(screen.getByRole("button", { name: "Download county list" }));

    expect(onStateChange).toHaveBeenCalledWith("CO");
    expect(onQueryChange).toHaveBeenCalledWith("Adams");
    expect(onEvidenceChange).toHaveBeenCalledWith("human");
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("selects a county from the accessible results table", () => {
    const onSelect = vi.fn();
    render(<ResultsTable counties={[county]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Adams, CO" }));

    expect(onSelect).toHaveBeenCalledWith("08001");
  });
});
