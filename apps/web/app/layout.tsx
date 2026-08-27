import './design-system/tokens.css';
import './styles.css';
import './workbench.css';
import './theme.css';
import './workspace.css';
import './a11y.css';
import {ThemeToggle} from './design-system/theme-toggle';
export const metadata={title:'媒體運行實驗室',description:'可追蹤、可復原並可驗證的媒體處理作品'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body><a className="skip-link" href="#main-content">跳至主要內容</a><ThemeToggle/><div id="main-content">{children}</div></body></html>}
