import Cycle from '@cycle/core';
import { span, p, div, form, button, input, img, makeDOMDriver } from '@cycle/dom';
import { Subject, Observable } from 'rx';
import { pusherObservable } from './pusher';
import { makeHTTPDriver } from '@cycle/http';
import strftime from 'strftime';


function main(sources) {

  const pusherMessages$ = pusherObservable('messages', 'new_message');

  const allPusherMessages$ = pusherMessages$.scan((acc, newData) => {
    if (newData) {
      return acc.concat([newData]);
    } else {
      return acc;
    }
  }, [{
    text: 'Hi there!',
    username: 'pusher',
    time: new Date()
  }, {
    text: 'How is it going?',
    username: 'pusher',
    time: new Date()
  }]);



  const username$ = sources.DOM
    .select('.swish-input')
    .events('change')
    .startWith({ target: { value: '' } })
    .map(e => e.target.value);

  const usernameSubmit$ = sources.DOM.select('.username-form').events('submit');

  const usernameChanges$ = Observable.combineLatest(
    username$,
    usernameSubmit$,
    (username, submitEvent) => username
  ).startWith('');


  const state$ = Observable.combineLatest(
    allPusherMessages$,
    usernameChanges$,
    (pusherMessages, username) => ({ pusherMessages, username })
  );

  const inputValue$ = sources.DOM
    .select('.input-message')
    .events('change')
    .startWith({ target: { value: '' } })
    .map(e => e.target.value)

  const messageSubmits$ = sources.DOM.select('.messages-form').events('submit');

  const sendClicks$ = sources.DOM.select('.send-message').events('click');

  const clickOrSubmit$ = Observable.merge(messageSubmits$, sendClicks$)

  const request$ = Observable.combineLatest(
    clickOrSubmit$,
    inputValue$,
    usernameChanges$,
    (submit, inputVal, username) => ({ inputVal, username })
    // TODO: this debounce stops duplicate messages - which I need to figure out why they happen
    // I think that listening to clicks & input value changes means we get an event when either one of those things happen
    // maybe?
  ).debounce(10).filter(
    ({ inputVal }) => inputVal !== ''
  ).map(({ inputVal, username }) => {
    return {
      method: 'POST',
      url: 'http://localhost:4567/messages',
      headers: {
        'Content-Type': 'application/json'
      },
      send: {
        time: new Date(),
        text: inputVal,
        username
      }
    }
  });

  sources.DOM.select(':root').observable.subscribe(() => {
    const messageList = document.querySelector('#message-list');
    if (messageList) {
      messageList.scrollTop = messageList.offsetHeight;
      console.log('called');
    }

    const input = document.querySelector('.input-message');
    if (input) {
      input.value = '';
    }
  });


  function phoneOverlay(body) {
    return div({ className: 'marvel-device iphone6 silver' }, [
      div({ className: 'top-bar' }),
      div({ className: 'sleep' }),
      div({ className: 'volume' }),
      div({ className: 'camera' }),
      div({ className: 'sensor' }),
      div({ className: 'speaker' }),
      div({ className: 'screen' }, body),
      div({ className: 'home' }),
      div({ className: 'bottom-bar' })
    ]);
  }

  function viewMessages(pusherMessages) {
    return phoneOverlay(
      div({ className: 'light-grey-blue-background chat-app' }, [
        div({ id: 'message-list' }, [
          div({ className: 'time-divide', attributes: { style: "margin-top: 15px" } }, [
            span({ className: 'date' }, 'Today' )
          ])
        ].concat(pusherMessages.map(({ text, username, time }) => {
          return div({ className: 'message' }, [
            div({ className: 'avatar' }, [
              img({ attributes: { src: `https://twitter.com/${username}/profile_image?size=original` } })
            ]),
            div({ className: 'text-display' }, [
              div({ className: 'message-data' }, [
                span({ className: 'author' }, username),
                span({ className: 'timestamp' }, strftime('%H:%M:%S %P', new Date(time))),
                span({ className: 'seen' }),
              ]),
              p({ className: 'message-body' }, text)
            ])
          ])
        }))),
        div({ className: 'action-bar' }, [
          form({ className: 'messages-form', onsubmit: (e) => e.preventDefault() }, [
            input({ className: 'input-message col-xs-10', attributes: { placeholder: 'Your message' } }),
            div({ className: 'option col-xs-1 green-background send-message' }, [
              span({ className: 'white light fa fa-paper-plane-o' })
            ])
          ])
        ])
      ])
    )
  }

  function viewUserinput() {
    return div([
      p({ className: 'light white' }, 'Enter your Twitter name and start chatting!'),
      div({ attributes: { style: 'margin-top: 20px' } }, [
        form({ className: 'username-form', onsubmit: (e) => e.preventDefault() }, [
          input({ id: 'input-name', attributes: { placeholder: 'Enter your Twitter name!', type: 'text' }, className: 'swish-input' }),
          button({ attributes: { type: 'submit' }, className: 'bright-blue-hover btn-white', id: 'try-it-out' }, 'Start chat')
        ])
      ])
    ])
  }

  function view(state$) {
    return state$.map(({ pusherMessages, username }) => {
      if (username) {
        return viewMessages(pusherMessages);
      } else {
        return viewUserinput();
      }
    })
  }

  return {
    DOM: view(state$),
    HTTP: request$
  }
}

const drivers = {
  DOM: makeDOMDriver('#app'),
  // we don't listen to the response, so we need to tell it to make HTTP requests anyway
  HTTP: makeHTTPDriver({ eager: true })
};

Cycle.run(main, drivers);

