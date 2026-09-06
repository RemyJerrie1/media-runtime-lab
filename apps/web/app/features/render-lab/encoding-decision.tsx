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
  const vmafRating =
    current.estimatedVmaf >= 95
      ? '視覺無損'
      : current.estimatedVmaf >= 90
        ? '優良'
        : current.estimatedVmaf >= 70
          ? '可接受'
          : '建議調整';
  return (
    <section className="encoding-decision" aria-labelledby="encoding-decision-title">
      <header className="decision-heading">
        <div>
          <p className="eyebrow">本次輸出預估</p>
          <h3 id="encoding-decision-title">1080p 預計輸出結果</h3>
        </div>
        <p className="decision-disclaimer">送出前先估算主要指標；完成後更新為實測結果。</p>
      </header>

      <div className="decision-summary" aria-label="目前編碼設定的輸出估算">
        <article>
          <span>1080p 輸出碼率</span>
          <strong>{current.targetKbps.toLocaleString()} kbps</strong>
          <small>
            {input.rateControl === 'crf' ? `由 CRF ${input.crf} 推估` : '由目標碼率指定'}
          </small>
        </article>
        <article>
          <span>預估 VMAF 畫質</span>
          <strong>
            {current.estimatedVmaf} · {vmafRating}
          </strong>
          <small>任務完成後更新為實測分數</small>
        </article>
        <article>
          <span>每小時影片容量</span>
          <strong>{current.storageGbHour} GB</strong>
          <small>用於估算儲存與 CDN 用量</small>
        </article>
      </div>

      <section className="vmaf-guide" aria-labelledby="vmaf-guide-title">
        <div>
          <h4 id="vmaf-guide-title">VMAF 判讀基準</h4>
          <p>分數越高，輸出越接近來源；相差約 6 分時，畫質差異通常較容易察覺。</p>
        </div>
        <dl>
          <div>
            <dt>95–100</dt>
            <dd>視覺無損</dd>
          </div>
          <div>
            <dt>90–94</dt>
            <dd>優良</dd>
          </div>
          <div>
            <dt>70–89</dt>
            <dd>可接受</dd>
          </div>
          <div>
            <dt>&lt; 70</dt>
            <dd>建議調整</dd>
          </div>
        </dl>
      </section>

      <div className="decision-grid">
        <div className="quality-curve">
          <h4>各畫質版本的 VMAF 預估</h4>
          <p>由左至右為 360p、540p、720p 與 1080p；數字為預估 VMAF。</p>
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
          <h4>預設 ABR 畫質階梯</h4>
          <p>提供不同頻寬與裝置使用的輸出版本。</p>
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
        <strong>目前設定：</strong>輸出四個 ABR 畫質版本；任務完成後以實測
        VMAF、碼率與檔案容量確認結果。
      </p>
    </section>
  );
}
