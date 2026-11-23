import "./chart-scrubber.css";

type Props = {
  label: string;
  start: number;
  end: number;
  max: number;
  value: number;
  onSelect: (index: number) => void;
};

export default function ChartScrubber({label,start,end,max,value,onSelect}:Props) {
  // start/end are fractions of the SVG width at the first and last data points.
  // Native ranges reserve half a thumb on both sides of their travel.
  return <input className="chart-scrubber" type="range" aria-label={label}
    min={0} max={max} value={value} disabled={max===0}
    style={{marginLeft:`calc(${100*start}% - 8px)`,width:`calc(${100*(end-start)}% + 16px)`}}
    onChange={event=>onSelect(Number(event.target.value))}/>;
}
