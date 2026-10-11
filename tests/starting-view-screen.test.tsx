import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace, writeSavedProfile } = vi.hoisted(() => ({
  replace: vi.fn<(path: string) => void>(),
  writeSavedProfile: vi.fn<() => Promise<unknown>>(),
}));

vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ replace }),
    }) as never
);

vi.mock(
  import("@/features/ux-reset/profile/saved-profile-client"),
  () =>
    ({
      writeSavedProfile,
    }) as never
);

vi.mock(
  import("@/features/ux-reset/settings/use-settings-state-options"),
  () =>
    ({
      useSettingsStateOptions: () => ({
        stateList: {
          options: [
            { code: "CO", name: "Colorado" },
            { code: "NY", name: "New York" },
          ],
          status: "ready",
        },
        stateOptions: [
          { code: "CO", name: "Colorado" },
          { code: "NY", name: "New York" },
        ],
      }),
    }) as never
);

import { StartingViewScreen } from "@/features/ux-reset/onboarding/starting-view-screen";
import { savedProfileFromUserProfile } from "@/features/ux-reset/profile/default-jurisdiction-contract";

const incomplete = savedProfileFromUserProfile({
  job_title: "Analyst",
  organization: "State lab",
  role: "state_level_epidemiologist",
  state_code: null,
});

describe("Choose your starting view", () => {
  afterEach(() => {
    cleanup();
    replace.mockReset();
    writeSavedProfile.mockReset();
  });

  it("starts with neither choice selected and hides the state list", () => {
    render(<StartingViewScreen profile={incomplete} />);

    expect(
      screen.getByRole("heading", { name: "Choose your starting view" })
    ).toBeTruthy();
    expect(
      (screen.getByRole("radio", { name: "United States" }) as HTMLInputElement)
        .checked
    ).toBeFalsy();
    expect(
      (screen.getByRole("radio", { name: "One state" }) as HTMLInputElement)
        .checked
    ).toBeFalsy();
    expect(screen.queryByLabelText("State")).toBeNull();
  });

  it("asks for a choice and then a state without saving", () => {
    render(<StartingViewScreen profile={incomplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose United States or one state to continue."
    );
    expect(writeSavedProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "One state" }));
    expect(screen.getByLabelText("State")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Select a state to continue."
    );
    expect(writeSavedProfile).not.toHaveBeenCalled();
  });

  it("continues only after version 1 matches the selected state", async () => {
    writeSavedProfile.mockResolvedValue({
      profile: savedProfileFromUserProfile({
        job_title: "Analyst",
        organization: "State lab",
        role: "state_level_epidemiologist",
        state_code: "NY",
        starting_view_version: 1,
      }),
      status: "confirmed",
    });
    render(<StartingViewScreen profile={incomplete} />);

    fireEvent.click(screen.getByRole("radio", { name: "One state" }));
    fireEvent.change(screen.getByLabelText("State"), {
      target: { value: "NY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));

    await expect(
      screen.findByText("Saving your starting view…")
    ).resolves.toBeTruthy();
    expect(writeSavedProfile).toHaveBeenCalledWith(
      {
        complete_starting_view: true,
        job_title: "Analyst",
        organization: "State lab",
        role: "state_level_epidemiologist",
        state_code: "NY",
      },
      undefined,
      incomplete
    );
    expect(replace).toHaveBeenCalledWith("/app/review");
  });

  it("keeps the selection when the save is not confirmed", async () => {
    writeSavedProfile.mockResolvedValue({
      message: "unconfirmed",
      status: "uncertain",
    });
    render(<StartingViewScreen profile={incomplete} />);

    fireEvent.click(screen.getByRole("radio", { name: "United States" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn’t save your starting view. Your selection is still here. Try again."
    );
    expect(
      (screen.getByRole("radio", { name: "United States" }) as HTMLInputElement)
        .checked
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
