import { ChevronDown } from '../components/Icons';
import { weeklyVolume } from '../placeholder';

const maxVolume = Math.max(...weeklyVolume);

export default function Progress() {
  return (
    <div className="page">
      <h1 className="h1">Progress</h1>

      <button className="select-btn">
        Bench press
        <ChevronDown size={18} />
      </button>

      <div className="tiles">
        <div className="tile">
          <div className="tile-val">96 kg</div>
          <div className="tile-label">estimated 1RM</div>
        </div>
        <div className="tile">
          <div className="tile-val gain">+8.5 kg</div>
          <div className="tile-label">in 12 weeks</div>
        </div>
        <div className="tile">
          <div className="tile-val">82.5 × 5</div>
          <div className="tile-label">best set</div>
        </div>
      </div>

      <section className="card roomy" style={{ gap: 10 }}>
        <div className="card-head">
          <h2 className="card-title">Estimated 1RM</h2>
          <div className="caption">last 12 weeks</div>
        </div>
        <svg
          className="chart"
          role="img"
          aria-label="Line chart of estimated one rep max rising from 87.5 kg to 96 kg over 12 weeks"
          viewBox="0 0 318 124"
        >
          <line x1="0" y1="73.6" x2="318" y2="73.6" stroke="#26292E" strokeWidth="1" />
          <line x1="0" y1="28.2" x2="318" y2="28.2" stroke="#26292E" strokeWidth="1" />
          <text x="0" y="68" fill="#A0A6AE" fontSize="10" fontFamily="Inter, sans-serif">
            90
          </text>
          <text x="0" y="23" fill="#A0A6AE" fontSize="10" fontFamily="Inter, sans-serif">
            95
          </text>
          <polyline
            fill="none"
            stroke="#C8F03C"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points="6,96.4 33.8,91.8 61.6,91.8 89.4,78.2 117.2,73.6 145,73.6 172.8,60 200.6,50.9 228.4,50.9 256.2,37.3 284,28.2 311.8,19.1"
          />
          <circle cx="311.8" cy="19.1" r="4.5" fill="#C8F03C" />
          <line x1="0" y1="116" x2="318" y2="116" stroke="#3A3E45" strokeWidth="1" />
        </svg>
        <div className="chart-axis">
          <div>19 Aug</div>
          <div>30 Sep</div>
          <div>11 Nov</div>
        </div>
      </section>

      <section className="card roomy">
        <div className="card-head">
          <h2 className="card-title">Weekly volume, all lifts</h2>
          <div className="caption">tonnes</div>
        </div>
        <div className="bars">
          {weeklyVolume.map((v, i) => (
            <div key={i} className="bar-col">
              <div>{v.toFixed(1)}</div>
              <div
                className={`bar${i === weeklyVolume.length - 1 ? ' current' : ''}`}
                style={{ height: `${Math.round((v / maxVolume) * 56)}px` }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="estimate">
        <div className="estimate-label">Estimate</div>
        <p className="estimate-body">
          At your current rate of about 0.7 kg a week, a 100 kg estimated max lands around 20 December. Two bench
          sessions a week has been your most productive pattern.
        </p>
      </section>
    </div>
  );
}
