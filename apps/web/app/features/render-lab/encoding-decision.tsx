import {
  abrLadder,
  estimateEncodingDecision,
  renditionCandidates,
  type EncodingDecisionInput,
} from './encoding-decision-model';
import type { RenderJob } from '@media-lab/contracts';

export function EncodingDecision({
  input,
  measuredRenditions,
}: {
  input: EncodingDecisionInput;
  measuredRenditions: RenderJob['renditions'];
}) {
  const current = estimateEncodingDecision(input);
  return (
    <section className="encoding-decision" aria-labelledby="encoding-decision-title">
      <header className="decision-heading">
        <div>
          <p className="eyebrow">編碼決策實驗室</p>
          <h3 id="encoding-decision-title">最高畫質，不一定是最佳播放體驗。</h3>
        </div>
        <p className="decision-disclaimer">
          編碼前只呈現容量與效能估算；VMAF 僅在後端完成實際比對後顯示。
        </p>
      </header>

      <div className="decision-summary" aria-label="目前參數的取捨預估">
        <article>
          <span>目標碼率</span>
          <strong>{current.targetKbps.toLocaleString()} kbps</strong>
          <small>
            {input.rateControl === 'crf' ? `由 CRF ${input.crf} 推估` : '由目標碼率指定'}
          </small>
        </article>
        <article>
          <span>預估品質指數</span>
          <strong>{current.estimatedVmaf}</strong>
          <small>碼率增加後效益遞減</small>
        </article>
        <article>
          <span>編碼成本指數</span>
          <strong>{current.encodeCost}×</strong>
          <small>
            {input.preset === 'slow'
              ? '精細編碼較慢'
              : input.preset === 'fast'
                ? '快速編碼較省算力'
                : '平衡基準'}
          </small>
        </article>
        <article>
          <span>每小時資料量</span>
          <strong>{current.storageGbHour} GB</strong>
          <small>同時影響儲存與 CDN</small>
        </article>
        <article data-risk={current.playbackRisk}>
          <span>播放風險</span>
          <strong>{current.playbackRisk}</strong>
          <small>以 6 Mbps 網路情境估算</small>
        </article>
        <article>
          <span>關鍵影格間隔</span>
          <strong>{current.keyframeSeconds} 秒</strong>
          <small>影響壓縮與 Seek</small>
        </article>
      </div>

      <div className="decision-grid">
        <div className="quality-curve">
          <h4>品質／碼率曲線</h4>
          <p>越往右成本越高；曲線變平後，繼續加碼率通常不划算。</p>
          <div className="curve-bars" role="img" aria-label="碼率增加時，預估品質增幅逐漸減少">
            {renditionCandidates.map((candidate) => (
              <div key={candidate.id}>
                <span style={{ height: `${candidate.vmaf - 72}%` }} />
                <strong>{candidate.vmaf}</strong>
                <small>{candidate.bitrateKbps / 1000}M</small>
              </div>
            ))}
          </div>
        </div>
        <div className="abr-ladder">
          <h4>建議 ABR Ladder</h4>
          <p>保留有效率且能覆蓋不同網路條件的版本。</p>
          <ol>
            {abrLadder.map((item) => (
              <li key={item.resolution}>
                <span>{item.resolution}</span>
                <strong>{item.bitrateKbps.toLocaleString()} kbps</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="candidate-table-wrap">
        <table className="candidate-table">
          <caption>編碼候選版本比較</caption>
          <thead>
            <tr>
              <th scope="col">解析度</th>
              <th scope="col">碼率</th>
              <th scope="col">預估品質</th>
              <th scope="col">編碼成本</th>
              <th scope="col">每小時資料量</th>
              <th scope="col">播放風險</th>
              <th scope="col">決策</th>
            </tr>
          </thead>
          <tbody>
            {renditionCandidates.map((candidate) => (
              <tr key={candidate.id} data-decision={candidate.decision}>
                <th scope="row">{candidate.resolution}</th>
                <td>{candidate.bitrateKbps.toLocaleString()} kbps</td>
                <td>{candidate.vmaf}</td>
                <td>{candidate.encodeCost}×</td>
                <td>{candidate.storageGbHour} GB</td>
                <td>{candidate.playbackRisk}</td>
                <td>
                  <strong>{candidate.decision}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {measuredRenditions.length ? (
        <section
          className="measured-renditions"
          data-tour="vmaf-results"
          aria-labelledby="vmaf-results-title"
        >
          <h4 id="vmaf-results-title">實際交付證據</h4>
          <p>以下數值來自本次後端工作，不沿用固定範例資料。</p>
          <ul>
            {measuredRenditions.map((rendition) => (
              <li key={rendition.id}>
                <strong>{rendition.id}</strong>
                <span>{rendition.bitrateKbps.toLocaleString()} kbps</span>
                <span>
                  {rendition.vmaf === null
                    ? '執行環境未提供 libvmaf'
                    : `VMAF ${rendition.vmaf.toFixed(1)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="decision-conclusion">
        <strong>決策：</strong>品質達標後，不再追逐最高碼率；把預算留給更穩定的播放、更多有效
        Rendition 與較低的 Rebuffering。
      </p>
    </section>
  );
}
