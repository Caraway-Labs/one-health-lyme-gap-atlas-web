import type { CountyScoreSummary } from "@/generated/models";

export function ResultsTable({ counties, onSelect }: { counties: CountyScoreSummary[]; onSelect: (fips: string) => void }) {
  return <div className="card full-table"><h3>Complete filtered results</h3><div className="table-scroll"><table><caption>All counties matching the current filters, ranked by Surveillance Gap Score.</caption><thead><tr><th>Rank</th><th>County</th><th>FIPS</th><th>Score</th><th>Priority</th></tr></thead><tbody>{counties.map((county, index) => <tr key={county.fips}><td>{index + 1}</td><td><button onClick={() => onSelect(county.fips)}>{county.county}, {county.state}</button></td><td>{county.fips}</td><td>{county.score.score}</td><td>{county.priority}</td></tr>)}</tbody></table></div></div>;
}
