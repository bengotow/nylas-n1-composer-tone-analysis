// // Tone Analyzer Plugin
// Last Revised: Sept. 24, 2016 by Ben Gotow

import {
  React,
  ComponentRegistry,
} from 'nylas-exports';

import NylasStore from 'nylas-store';
import {RetinaImg} from 'nylas-component-kit';

import watson from 'watson-developer-cloud';


const toneAnalyzer = watson.tone_analyzer({
  url: 'https://gateway.watsonplatform.net/tone-analyzer/api/',
  password: '2sjUoalerC8p',
  username: 'accca761-908f-4d07-9ea9-7a3e15472061',
  version_date: '2016-05-19',
  version: 'v3',
  headers: {
    // tell IBM not to log email contents
    "X-Watson-Learning-Opt-Out": "1",
  },
});

class ToneCheckStore extends NylasStore {
  constructor() {
    super();
    this._cache = {};
  }
  onToneFetched(draftId, tone) {
    this._cache[draftId] = tone;
    this.trigger();
  }
  toneForDraftId(draftId) {
    return this._cache[draftId];
  }
}

const Store = new ToneCheckStore();

class ToneCheckResults extends React.Component {
  static displayName = "ToneCheckResults";
  static propTypes = {
    draft: React.PropTypes.object.isRequired,
    session: React.PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = this.getStateFromStore();
  }

  componentDidMount() {
    this._unlisten = Store.listen(() => {
      this.setState(this.getStateFromStore());
    })
  }

  getStateFromStore() {
    return {tone: Store.toneForDraftId(this.props.draft.id)};
  }

  _renderTone = (tone) => {
    let accent = '';
    if ((tone.tone_name === 'Anger') && (tone.score > 0.8)) {
      accent = 'red';
    }
    return (
      <div className="tone">
        <label>{tone.tone_name}</label>
        <div className={`tone-bar ${accent}`}>
          <div style={{width: `${tone.score * 100}%`}}></div>
        </div>
      </div>
    )
  }

  _renderSummary(toneCategories) {
    let msg = "Looks alright to me! 👌";
    let color = '';

    const scoresById = {};
    for (const category of toneCategories) {
      for (const {tone_id, score} of category.tones) {
        scoresById[tone_id] = score;
      }
    }
    if (scoresById.anger > 0.85) {
      msg = "Feeling a little 😠 ? Maybe you should wait a bit.";
      color = "rgba(255, 128, 128, 0.4)";
    } else if (scoresById.joy > 0.85) {
      msg = "Feeling a little ☺️ ? Take some pro advice—don't sound too excited.";
      color = "rgba(128, 255, 128, 0.4)";
    } else if (scoresById.sadness > 0.85) {
      msg = "😥 right now? Maybe you should save this one as a draft.";
      color = "rgba(128, 128, 255, 0.4)";
    }
    return (
      <div className="summary" style={{backgroundColor: color}}>
        {msg}
      </div>
    );
  }

  render() {
    if (!this.state.tone) {
      return <span />;
    }

    const {tone_categories} = this.state.tone.document_tone;

    return (
      <div className="tone-analysis">
        {this._renderSummary(tone_categories)}
        <div className="detail">
        {
          tone_categories.map((category) => {
            return (
              <div className="category">
                <h2>{category.category_name}</h2>
                <div className="tones">
                  {category.tones.map(this._renderTone)}
                </div>
              </div>
            );
          })
        }
        </div>
      </div>
    );
  }
}

class ToneCheckButton extends React.Component {
  static displayName = 'ToneCheckButton';

  static propTypes = {
    draft: React.PropTypes.object.isRequired,
    session: React.PropTypes.object.isRequired,
  };

  _onClick = () => {
    this.setState({loading: true});
    toneAnalyzer.tone({text: this.props.draft.body}, (err, data) => {
      this.setState({loading: false});
      if (err) {
        NylasEnv.reportError(err);
        return;
      }
      // normally would fire an action here
      Store.onToneFetched(this.props.draft.id, data);
    });
  }

  render() {
    if (this.state && this.state.loading) {
      return (
        <button className="btn btn-toolbar btn-tone-check" tabIndex={-1}>
          <RetinaImg
            name="inline-loading-spinner.gif"
            mode={RetinaImg.Mode.ContentDark}
            style={{width: 14, height: 14}}
          />
        </button>
      );
    }

    return (
      <button
        tabIndex={-1}
        className="btn btn-toolbar btn-tone-check"
        onClick={this._onClick}
        title="Check message tone…"
      >
        <RetinaImg
          mode={RetinaImg.Mode.ContentPreserve}
          style={{imageRendering: 'pixelated'}}
          url="nylas://composer-tone-analysis/assets/peppers.png"
        />
      </button>
    );
  }
}

/*
All packages must export a basic object that has at least the following 2
methods:

1. `activate` - Actions to take once the package gets turned on.
Pre-enabled packages get activated on N1 bootup. They can also be
activated manually by a user.

2. `deactivate` - Actions to take when a package gets turned off. This can
happen when a user manually disables a package.
*/

export function activate() {
  ComponentRegistry.register(ToneCheckResults, {
    role: 'Composer:Footer',
  });
  ComponentRegistry.register(ToneCheckButton, {
    role: 'Composer:ActionButton',
  });
}

export function deactivate() {
  ComponentRegistry.unregister(ToneCheckResults);
  ComponentRegistry.unregister(ToneCheckButton);
}
