import type { CountyScoreSummary } from "@/generated/models";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ResultsTable({ counties, onSelect }: { counties: CountyScoreSummary[]; onSelect: (fips: string) => void }) {
  return <div className="card full-table"><h3>Complete county list</h3><div className="table-scroll"><Table><TableCaption>All counties matching the current filters, ranked by County Review Priority.</TableCaption><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>County</TableHead><TableHead>FIPS</TableHead><TableHead>Review priority</TableHead><TableHead>Suggested action</TableHead></TableRow></TableHeader><TableBody>{counties.map((county, index) => <TableRow key={county.fips}><TableCell>{index + 1}</TableCell><TableCell><Button variant="link" size="sm" onClick={() => onSelect(county.fips)}>{county.county}, {county.state}</Button></TableCell><TableCell>{county.fips}</TableCell><TableCell>{county.score.score}</TableCell><TableCell>{county.priority}</TableCell></TableRow>)}</TableBody></Table></div></div>;
}
