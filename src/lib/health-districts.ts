export const HEALTH_DISTRICTS: Record<
  string,
  { id: string; name: string; counties: string[] }[]
> = {
  ID: [
    {
      counties: ["Benewah", "Bonner", "Boundary", "Kootenai", "Shoshone"],
      id: "ID-1",
      name: "Panhandle Health District",
    },
    {
      counties: ["Clearwater", "Idaho", "Latah", "Lewis", "Nez Perce"],
      id: "ID-2",
      name: "Idaho North Central Health District",
    },
    {
      counties: ["Adams", "Canyon", "Gem", "Owyhee", "Payette", "Washington"],
      id: "ID-3",
      name: "Southwest District Health",
    },
    {
      counties: ["Ada", "Boise", "Elmore", "Valley"],
      id: "ID-4",
      name: "Central District Health",
    },
    {
      counties: [
        "Blaine",
        "Camas",
        "Cassia",
        "Gooding",
        "Jerome",
        "Lincoln",
        "Minidoka",
        "Twin Falls",
      ],
      id: "ID-5",
      name: "South Central Public Health District",
    },
    {
      counties: [
        "Bannock",
        "Bear Lake",
        "Bingham",
        "Butte",
        "Caribou",
        "Franklin",
        "Oneida",
        "Power",
      ],
      id: "ID-6",
      name: "Southeastern Idaho Public Health",
    },
    {
      counties: [
        "Bonneville",
        "Clark",
        "Custer",
        "Fremont",
        "Jefferson",
        "Lemhi",
        "Madison",
        "Teton",
      ],
      id: "ID-7",
      name: "Eastern Idaho Public Health",
    },
  ],
};

export function countyBelongsToDistrict(
  state: string,
  county: string,
  selectedState: string,
  districtId: string
) {
  const district = HEALTH_DISTRICTS[selectedState]?.find(
    (item) => item.id === districtId
  );
  const normalize = (value: string) =>
    value
      .replace(/\s+County$/i, "")
      .trim()
      .toLowerCase();
  return (
    state === selectedState &&
    Boolean(
      district?.counties.some((name) => normalize(name) === normalize(county))
    )
  );
}
