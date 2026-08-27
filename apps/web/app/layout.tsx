import './design-system/tokens.css';
import './styles.css';
import './workbench.css';
import './theme.css';
import './workspace.css';
import './a11y.css';
import {ThemeToggle} from './design-system/theme-toggle';
export const metadata={title:'Media Runtime Lab',description:'Governed media runtime with deterministic rendering and contract-tested delivery'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body><ThemeToggle/>{children}</body></html>}
