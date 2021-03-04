import cs from 'classnames'
import { observer } from 'mobx-react'
import * as React from 'react'

import { Reporter } from '@packages/reporter/src/main'

import errorMessages from '../errors/error-messages'
import State from '../lib/state'

import SplitPane from 'react-split-pane'
import Header from '../header/header'
import Iframes from '../iframe/iframes'
import Message from '../message/message'
import { EmptyReporterHeader, ReporterHeader } from './ReporterHeader'
import EventManager from '../lib/event-manager'
import { Hidden } from '../lib/Hidden'
import { SpecList } from '../SpecList'
import { Burger } from '../icons/Burger'
import { ResizableBox } from '../lib/ResizableBox'
import { useWindowSize } from '../lib/useWindowSize'
import { useGlobalHotKey } from '../lib/useHotKey'

import { LeftNav } from '@cypress/design-system'
import styles from './RunnerCt.module.scss'

import './RunnerCt.scss'
import { KeyboardHelper, NoSpecSelected } from './NoSpecSelected'
import { useScreenshotHandler } from './useScreenshotHandler'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'

library.add(fas)
library.add(fab)
library.add(far)

interface AppProps {
  state: State
  eventManager: typeof EventManager
  config: Cypress.RuntimeConfigOptions
}

// enum NavItems {
//   SPECS_LIST
//   COMMAND_LOG
// }

const items = {

}

const PLUGIN_BAR_HEIGHT = 40
const DEFAULT_LEFT_SIDE_OF_SPLITPANE_WIDTH = 355
// needs to account for the left bar + the margins around the viewport
const VIEWPORT_SIDE_MARGIN = 40 + 17

const App: React.FC<AppProps> = observer(
  function App (props: AppProps) {
    const searchRef = React.useRef<HTMLInputElement>(null)
    const splitPaneRef = React.useRef<{ splitPane: HTMLDivElement }>(null)
    const pluginRootContainer = React.useRef<null | HTMLDivElement>(null)

    const { state, eventManager, config } = props
    const isOpenMode = !config.isTextTerminal

    const [pluginsHeight, setPluginsHeight] = React.useState(500)
    const [isResizing, setIsResizing] = React.useState(false)

    const [isSpecsListOpen, setIsSpecsListOpen] = React.useState(isOpenMode)
    const [isCommandLogOpen, setIsCommandLogOpen] = React.useState(config.isTextTerminal || state.spec)    

    const [drawerWidth, setDrawerWidth] = React.useState(300)
    const windowSize = useWindowSize()
    const [leftSideOfSplitPaneWidth, setLeftSideOfSplitPaneWidth] = React.useState(DEFAULT_LEFT_SIDE_OF_SPLITPANE_WIDTH)
    const [activeIndex, setActiveIndex] = React.useState<number>(0)
    const headerRef = React.useRef(null)

    const runSpec = (spec: Cypress.Cypress['spec']) => {
      setActiveIndex(0)
      state.setSingleSpec(spec)
    }

    function monitorWindowResize () {
      // I can't use forwardref in class based components
      // Header still is a class component
      // FIXME: use a forwardRef when available
      const header = headerRef.current.headerRef

      function onWindowResize () {
        state.updateWindowDimensions({
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          reporterWidth: leftSideOfSplitPaneWidth + VIEWPORT_SIDE_MARGIN,
          headerHeight: header.offsetHeight || 0,
        })
      }

      window.addEventListener('resize', onWindowResize)
      window.dispatchEvent(new Event('resize'))
    }

    React.useEffect(() => {
      if (pluginRootContainer.current) {
        state.initializePlugins(config, pluginRootContainer.current)
      }

      monitorWindowResize()
    }, [])

    useScreenshotHandler({
      state,
      eventManager,
      splitPaneRef,
    })

    function toggleSpecsList() {
      setActiveIndex((isOpenNow) => isOpenNow === 0 ? undefined : 0)
    }

    function focusSpecsList () {
      // setIsSpecsListOpen(true)
      setActiveIndex(0)

      // a little trick to focus field on the next tick of event loop
      // to prevent the handled keydown/keyup event to fill input with "/"
      setTimeout(() => {
        searchRef.current?.focus()
      }, 0)
    }

    useGlobalHotKey('ctrl+b,command+b', toggleSpecsList)
    useGlobalHotKey('/', focusSpecsList)

    function onSplitPaneChange (newWidth: number) {
      setLeftSideOfSplitPaneWidth(newWidth)
      state.updateWindowDimensions({
        reporterWidth: newWidth + VIEWPORT_SIDE_MARGIN,
        windowWidth: null,
        windowHeight: null,
        headerHeight: null,
      })
    }


    return (
      <>
        <main className={cs("app-ct", styles.app)}>
          <LeftNav activeIndex={activeIndex}
            leftNavClasses={styles.leftNav}
            navButtonClasses="button-class"
            items={[
              {

                id: 'file-explorer-nav',
                title: 'File Explorer',
                icon: 'copy',
                interaction: {
                  type: 'js',
                  onClick(index) {
                    if (activeIndex !== index) {
                      setActiveIndex(index)
                      // setIsSpecsListOpen(true)
                      return
                    }

                    setActiveIndex(undefined)
                    // setIsSpecsListOpen(false)
                    return
                  }
                }
              },
              {
                id: 'command-log-nav',
                title: 'Command Log',
                icon: 'stream',
                interaction: {
                  type: 'js',
                  onClick(index) {
                    setIsSpecsListOpen(false)
                    if (activeIndex !== index) {
                      setActiveIndex(index)
                      return
                    }
                    setActiveIndex(undefined)
                  }
                }
              },
              {
                id: 'docs-nav',
                title: 'Cypress Documentation',
                icon: 'book',
                interaction: {
                  type: 'anchor',
                  href: 'https://on.cypress.io/component-testing'
                }
              },
            ]}></LeftNav>
          <SplitPane
            split="vertical"
            primary="first"
            // @ts-expect-error split-pane ref types are weak so we are using our custom type for ref
            ref={splitPaneRef}
            minSize={state.screenshotting ? 0 : 200}
            // calculate maxSize of IFRAMES preview to not cover specs list and command log
            maxSize={state.screenshotting ? 0 : windowSize.width / 100 * 80}
            defaultSize={state.screenshotting ? 0 : 355}
            onDragStarted={() => setIsResizing(true)}
            onDragFinished={() => setIsResizing(false)}
            onChange={setDrawerWidth}
            style={{ overflow: 'unset', position: 'relative' }}
            resizerStyle={{height: '100vh'}}
            className={cs(styles.appSplitPane, { 'is-reporter-resizing': isResizing })}
          >
            { isOpenMode ? <SpecList
              specs={state.specs}
              inputRef={searchRef}
              selectedSpecs={state.spec ? [state.spec.absolute] : []}
              className={cs(styles.specsList, {
                'display-none': state.screenshotting || activeIndex !== 0
              })}
              onSelectSpec={runSpec}
            /> : <div></div>}

          
          {/* {isOpenMode && (
            <div
              className={cs(
                styles.specsList,
                {
                  'display-none': state.screenshotting || activeIndex !== 0,
                },
              )}
              style={{
                // transform: isSpecsListOpen ? `translateX(0)` : `translateX(-${drawerWidth - 20}px)`,
              }}
            >
              <ResizableBox
                disabled={!isSpecsListOpen}
                width={drawerWidth}
                onIsResizingChange={setIsResizing}
                onWidthChange={setDrawerWidth}
                className="specs-list-container"
                data-cy="specs-list-resize-box"
                resizerClass="spec-list-resize"
                minWidth={200}
                maxWidth={windowSize.width / 100 * 80} // 80vw
              >
               
              </ResizableBox>
            </div>
          )} */}

          <div className={cs(styles.appWrapper, 'app-wrapper', {
            'with-specs-drawer': isOpenMode,
            'app-wrapper-screenshotting': state.screenshotting,
          })}>
            <SplitPane
              split="vertical"
              primary="first"
              // @ts-expect-error split-pane ref types are weak so we are using our custom type for ref
              ref={splitPaneRef}
              minSize={state.screenshotting ? 0 : 100}
              // calculate maxSize of IFRAMES preview to not cover specs list and command log
              maxSize={state.screenshotting ? 0 : windowSize.width / 100 * 80}
              defaultSize={state.screenshotting ? 0 : 355}
              onDragStarted={() => setIsResizing(true)}
              onDragFinished={() => setIsResizing(false)}
              onChange={onSplitPaneChange}
              style={{ overflow: 'unset' }}
              className={cs('reporter-pane', { 'is-reporter-resizing': isResizing })}
            >
              <div style={{ height: '100%' }}>
                {state.spec ? (
                  <Reporter
                    runMode={state.runMode}
                    runner={eventManager.reporterBus}
                    className={cs({ 'display-none': state.screenshotting }, styles.reporter)}
                    spec={state.spec}
                    specRunId={state.specRunId}
                    allSpecs={state.multiSpecs}
                    error={errorMessages.reporterError(state.scriptError, state.spec.relative)}
                    firefoxGcInterval={config.firefoxGcInterval}
                    resetStatsOnSpecChange={state.runMode === 'single'}
                    renderReporterHeader={(props) => <ReporterHeader {...props} />}
                    experimentalStudioEnabled={false}
                  />
                ) : (
                  <div className="reporter">
                    <EmptyReporterHeader />
                    <NoSpecSelected onSelectSpecRequest={focusSpecsList} />
                  </div>
                )}
              </div>
              <SplitPane
                primary="second"
                split="horizontal"
                onChange={setPluginsHeight}
                allowResize={state.isAnyDevtoolsPluginOpen}
                onDragStarted={() => setIsResizing(true)}
                onDragFinished={() => setIsResizing(false)}
                size={
                  state.isAnyDevtoolsPluginOpen
                    ? pluginsHeight
                    // show the small not resize-able panel with buttons or nothing
                    : state.isAnyPluginToShow ? PLUGIN_BAR_HEIGHT : 0
                }
              >
                <div className={cs('runner runner-ct container', { screenshotting: state.screenshotting })}>
                  <Header {...props} ref={headerRef}/>
                  {!state.spec ? (
                    <NoSpecSelected onSelectSpecRequest={focusSpecsList}>
                      <KeyboardHelper />
                    </NoSpecSelected>
                  ) : (
                    <Iframes {...props} />
                  )}
                  <Message state={state}/>
                </div>

                <Hidden type="layout" hidden={!state.isAnyPluginToShow} className="ct-plugins">
                  <div className="ct-plugins-header">
                    {state.plugins.map((plugin) => (
                      <button
                        key={plugin.name}
                        onClick={() => state.openDevtoolsPlugin(plugin)}
                        className={cs('ct-plugin-toggle-button', {
                          'ct-plugin-toggle-button-selected': state.activePlugin === plugin.name,
                        })}
                      >
                        <span className='ct-plugins-name'>{plugin.name}</span>
                        <div
                          className={cs('ct-toggle-plugins-section-button', {
                            'ct-toggle-plugins-section-button-open': state.isAnyDevtoolsPluginOpen,
                          })}
                        >
                          <i className='fas fa-chevron-up ct-plugins-name' />
                        </div>
                      </button>
                    ))}
                  </div>

                  <Hidden
                    type="layout"
                    ref={pluginRootContainer}
                    className="ct-devtools-container"
                    // deal with jumps when inspecting element
                    hidden={!state.isAnyDevtoolsPluginOpen}
                    style={{ height: pluginsHeight - PLUGIN_BAR_HEIGHT }}
                  />
                </Hidden>
              </SplitPane>
            </SplitPane>
            
          </div>
          </SplitPane>
          {/* these pixels help ensure the browser has painted when taking a screenshot */}
          <div className='screenshot-helper-pixels'>
            <div/>
            <div/>
            <div/>
            <div/>
            <div/>
            <div/>
          </div>
        </main>
      </>
    )
  },
)

export default App
