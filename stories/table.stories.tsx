import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const rows = [
  ["08001", "Adams County", "Colorado"],
  ["08013", "Boulder County", "Colorado"],
  ["37183", "Wake County", "North Carolina"],
] as const;

const presets = ["populated", "empty", "long"] as const;
type TablePreset = (typeof presets)[number];

function TableStory({ preset }: { preset: TablePreset }) {
  const body =
    preset === "empty"
      ? []
      : rows.map((row) =>
          preset === "long"
            ? ([
                row[0],
                `${row[1]} — synthetic note that stays in the cell and can extend past a narrow preview`,
                row[2],
              ] as const)
            : row
        );
  return (
    <Table>
      <TableCaption>Synthetic counties in the lower 48 and DC.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>FIPS</TableHead>
          <TableHead>County</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {body.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3}>No rows in this preview.</TableCell>
          </TableRow>
        ) : (
          body.map((row) => (
            <TableRow key={row[0]}>
              {row.map((cell) => (
                <TableCell key={cell}>{cell}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

const meta = {
  title: "Primitives/Table",
  component: TableStory,
  args: { preset: "populated" },
  argTypes: { preset: { control: "select", options: [...presets] } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: caption, header, and rows. Source: src/components/ui/table.tsx. Limitations: rows are synthetic Adams, Boulder, and Wake counties. There is no sorting or pagination control.",
      },
    },
  },
} satisfies Meta<typeof TableStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Empty: Story = { args: { preset: "empty" } };
export const LongCell: Story = { args: { preset: "long" } };
