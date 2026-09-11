import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CountyScoreSummary } from "@/generated/models";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

export function ResultsTable({
  counties,
  onSelect,
}: {
  counties: CountyScoreSummary[];
  onSelect: (fips: string) => void;
}) {
  return (
    <Card className="full-table gap-0 py-0">
      <h3>Complete county list</h3>
      <div className="table-scroll">
        <Table>
          <TableCaption>
            All counties matching the current filters, ranked by County Review
            Priority.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>County</TableHead>
              <TableHead>FIPS</TableHead>
              <TableHead>Review priority</TableHead>
              <TableHead>Suggested action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counties.map((county, index) => (
              <TableRow key={county.fips}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Button
                    {...analyticsControlAttributes(
                      "results_table_county_select"
                    )}
                    variant="link"
                    size="sm"
                    onClick={() => onSelect(county.fips)}
                  >
                    {county.county}, {county.state}
                  </Button>
                </TableCell>
                <TableCell>{county.fips}</TableCell>
                <TableCell>{county.score.score}</TableCell>
                <TableCell>{county.priority}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
