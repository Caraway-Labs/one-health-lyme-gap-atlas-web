import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  PERSONA_AUDIENCES,
  PERSONA_GATEWAY_PATH,
  PERSONA_PUBLIC_SAMPLE_NOTICE,
  otherPersonaAudiences,
  personaAudienceById,
  personaAudiencePath,
  personaSampleNotice,
  personaTopicById,
  personaTopicPath,
} from "@/features/ux-lab/persona-gateway/content";
import { PersonaGatewayPage } from "@/features/ux-lab/persona-gateway/persona-gateway-page";
import {
  PersonaLanePage,
  PersonaTopicPage,
} from "@/features/ux-lab/persona-gateway/persona-lane";
import {
  UX_LAB_AUDIENCES,
  UX_LAB_SAMPLE_NOTICE,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";

const PUBLIC_JARGON =
  /surveillance|incidence|epidemiolog|underreport|case rate|priority score|action center/i;

describe("Persona Gateway prototype", () => {
  afterEach(cleanup);

  it("offers three distinct audience destinations from the front door", () => {
    render(<PersonaGatewayPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Which audience experience do you need?",
      })
    ).toBeTruthy();

    for (const audience of UX_LAB_AUDIENCES) {
      const definition = PERSONA_AUDIENCES[audience];
      expect(
        screen
          .getByRole("link", { name: definition.title })
          .getAttribute("href")
      ).toBe(personaAudiencePath(audience));
    }
  });

  it("keeps the public lane in plain language", () => {
    const audience = PERSONA_AUDIENCES.public;
    const topics = uxLabSampleTopicsForAudience("public");
    render(<PersonaLanePage audience={audience} topics={topics} />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(PUBLIC_JARGON);
    expect(text).toContain(PERSONA_PUBLIC_SAMPLE_NOTICE);
    expect(screen.getByRole("link", { name: "Tick awareness" })).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Switch audience" })
    ).toBeTruthy();
  });

  it("labels the clinician lane as resources rather than patient-specific advice", () => {
    const audience = PERSONA_AUDIENCES.clinician;
    render(
      <PersonaLanePage
        audience={audience}
        topics={uxLabSampleTopicsForAudience("clinician")}
      />
    );

    expect(screen.getByRole("note").textContent).toMatch(/specific patient/i);
    expect(
      screen
        .getByRole("link", { name: "Clinician resource cards" })
        .getAttribute("href")
    ).toBe(personaTopicPath("clinician", "clinician-resources"));
  });

  it("connects the public-health lane to the professional Atlas", () => {
    const audience = PERSONA_AUDIENCES["public-health"];
    render(
      <PersonaLanePage
        audience={audience}
        topics={uxLabSampleTopicsForAudience("public-health")}
      />
    );

    expect(document.body.textContent).toContain("Action Center");
    expect(document.body.textContent).toMatch(/advanced professional Atlas/i);
    expect(
      screen
        .getByRole("link", { name: "You & Your Family" })
        .getAttribute("href")
    ).toBe(personaAudiencePath("public"));
  });

  it("confirms the selected lane on a second-level topic", () => {
    const audience = PERSONA_AUDIENCES.public;
    const topic = personaTopicById("public", "tick-awareness");
    if (!topic) {
      throw new Error("Expected the public tick-awareness sample topic");
    }

    render(<PersonaTopicPage audience={audience} topic={topic} />);

    expect(document.body.textContent).toContain(
      "You are in You & Your Family, looking at Tick awareness."
    );
    expect(document.body.textContent).not.toMatch(PUBLIC_JARGON);
    expect(
      screen
        .getByRole("link", { name: "Yes — stay in You & Your Family" })
        .getAttribute("href")
    ).toBe(personaAudiencePath("public"));
    expect(
      screen
        .getByRole("link", { name: "Healthcare Professionals" })
        .getAttribute("href")
    ).toBe("/ux-lab/persona-gateway/clinician");
  });

  it("resolves prototype audiences and rejects unknown ids", () => {
    expect(personaAudienceById("public")?.title).toBe("You & Your Family");
    expect(personaAudienceById("missing")).toBeUndefined();
    expect(personaTopicById("public", "action-center")).toBeUndefined();
    expect(PERSONA_GATEWAY_PATH).toBe("/ux-lab/persona-gateway");
  });

  it("keeps sample notices and sibling audiences audience-specific", () => {
    expect(personaTopicById("public", "tick-awareness")?.title).toBe(
      "Tick awareness"
    );
    expect(personaSampleNotice("public")).toBe(PERSONA_PUBLIC_SAMPLE_NOTICE);
    expect(personaSampleNotice("clinician")).toBe(UX_LAB_SAMPLE_NOTICE);
    expect(
      otherPersonaAudiences("clinician").map((item) => item.id)
    ).toStrictEqual(["public", "public-health"]);
  });
});
