/**
 * DDS — form validation pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/form-validation.js" defer></script>
 *
 * Accessible client-side validation built on the platform's Constraint
 * Validation API.
 *
 * -----------------------------------------------------------------------------
 * What this adds, and what it deliberately does not
 * -----------------------------------------------------------------------------
 *
 * The constraints themselves stay in the markup: `required`, `type="email"`,
 * `minlength`, `pattern`, `min`, `max`. The browser already evaluates them, in
 * every language, and exposes the result through `checkValidity()`. Re-writing
 * that in JavaScript means a second rulebook that will drift from the first.
 *
 * What the platform does badly is the *presentation*: native validation bubbles
 * cannot be styled, vanish on their own, are not reliably announced, appear one
 * at a time, and are lost entirely once the user scrolls. That is what this
 * replaces.
 *
 * Client validation is a convenience, never a guarantee. The server validates
 * again, always.
 *
 * -----------------------------------------------------------------------------
 * When errors are shown — the part that matters most
 * -----------------------------------------------------------------------------
 *
 * Not while typing. Not on first blur of an untouched field. Only:
 *
 *   - on submit, for every invalid field at once, and
 *   - after that, on blur, for a field the user has already been told about.
 *
 * Validating early looks helpful and is not: telling someone their email is
 * invalid after they have typed two characters is telling them off for not
 * having finished. People learn to ignore error styling that is always present,
 * which is exactly the styling you need them to read later.
 *
 * -----------------------------------------------------------------------------
 * The error summary
 * -----------------------------------------------------------------------------
 *
 * On a failed submit, a summary appears at the top listing every problem, each
 * entry linking to its field, and focus moves to it. This is the single highest
 * -value accessibility feature in any form: without it a user whose submit
 * failed has no idea how many things are wrong or where, and has to walk the
 * whole form again to find out.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] form-validation.js requires dds.js to be loaded first');
    return;
  }

  /**
   * Default messages.
   *
   * The browser's own messages are localised but often unhelpful ("Please match
   * the requested format" tells the user nothing). These say what is wrong and
   * what to do, and a field can override any of them with
   * `data-dds-error-<constraint>`.
   */
  var WORDING = {
    en: {
      valueMissing: 'Enter {label}',
      typeMismatch: 'Enter {label} in the correct format',
      typeMismatchEmail: 'Enter an email address, for example name@example.org',
      typeMismatchUrl: 'Enter a full web address, starting with https://',
      tooShort: '{label} must be at least {minlength} characters',
      tooLong: '{label} must be {maxlength} characters or fewer',
      rangeUnderflow: '{label} must be {min} or more',
      rangeOverflow: '{label} must be {max} or less',
      stepMismatch: '{label} is not an accepted value',
      patternMismatch: 'Enter {label} in the correct format',
      badInput: 'Enter {label} as a number',
      default: 'Check {label}',
      /** Read before the message, for anyone who gets neither the colour nor the icon. */
      errorPrefix: 'Error: ',
      /** The summary heading. No full stop: it is a heading, not a sentence. */
      summary: { one: 'There is 1 problem with this form', other: 'There are {n} problems with this form' },
      /** The same count spoken. A full stop, because it is read aloud as a sentence. */
      summaryAnnouncement: {
        one: 'There is 1 problem with this form.',
        other: 'There are {n} problems with this form.',
      },
    },
    de: {
      valueMissing: '{label} eingeben',
      typeMismatch: '{label} im richtigen Format eingeben',
      typeMismatchEmail: 'E-Mail-Adresse eingeben, zum Beispiel name@example.org',
      typeMismatchUrl: 'Vollständige Webadresse eingeben, beginnend mit https://',
      tooShort: '{label} muss mindestens {minlength} Zeichen lang sein',
      tooLong: '{label} darf höchstens {maxlength} Zeichen lang sein',
      rangeUnderflow: '{label} muss {min} oder mehr sein',
      rangeOverflow: '{label} darf höchstens {max} sein',
      stepMismatch: '{label} ist kein zulässiger Wert',
      patternMismatch: '{label} im richtigen Format eingeben',
      badInput: '{label} als Zahl eingeben',
      default: '{label} prüfen',
      errorPrefix: 'Fehler: ',
      summary: { one: 'Es gibt 1 Problem in diesem Formular', other: 'Es gibt {n} Probleme in diesem Formular' },
      summaryAnnouncement: {
        one: 'Es gibt 1 Problem in diesem Formular.',
        other: 'Es gibt {n} Probleme in diesem Formular.',
      },
    },
  };

  /**
   * The English table, kept as `DDS.formValidation.messages` was.
   *
   * Exported for the same reason it always was — a product reading the default
   * for one constraint to write a variation of it — and it is English because
   * that is the fallback every other language falls back to. A caller wanting
   * the wording actually in use for a field asks `messageFor(field)`, which
   * resolves the language the field sits in.
   */
  var MESSAGES = WORDING.en;

  /** The visible label text for a control, used inside messages. */
  function labelFor(field) {
    // An explicit override wins: a message reads better with "your email
    // address" than with the terse label "Email".
    var override = field.getAttribute('data-dds-label');
    if (override) return override;

    var label = field.labels && field.labels[0];
    if (label) {
      // Strip the "(required)" / "(optional)" marker so it does not end up
      // inside the sentence.
      var clone = label.cloneNode(true);
      clone.querySelectorAll('.dds-label-note').forEach(function (note) {
        note.remove();
      });
      return clone.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    return field.getAttribute('aria-label') || field.name || 'this field';
  }

  /** Choose and fill in the message for a field's current validity state. */
  function messageFor(field) {
    var validity = field.validity;
    var label = labelFor(field);
    /* The FIELD's language, not the form's. A form may hold a part in another
       language and has to say so anyway (WCAG 3.1.2), and a field inside that
       part is spoken in it — so the error about it is too. */
    var words = DDS.utils.wording(field, WORDING);

    function resolve(key) {
      var custom = field.getAttribute('data-dds-error-' + key.toLowerCase());
      var template = custom || words[key] || words.default;
      return template
        .replace('{label}', label)
        .replace('{minlength}', field.getAttribute('minlength') || '')
        .replace('{maxlength}', field.getAttribute('maxlength') || '')
        .replace('{min}', field.getAttribute('min') || '')
        .replace('{max}', field.getAttribute('max') || '');
    }

    if (validity.valueMissing) return resolve('valueMissing');

    if (validity.typeMismatch) {
      // Type-specific wording, because "correct format" is not actionable.
      if (field.type === 'email') return resolve('typeMismatchEmail');
      if (field.type === 'url') return resolve('typeMismatchUrl');
      return resolve('typeMismatch');
    }

    if (validity.tooShort) return resolve('tooShort');
    if (validity.tooLong) return resolve('tooLong');
    if (validity.rangeUnderflow) return resolve('rangeUnderflow');
    if (validity.rangeOverflow) return resolve('rangeOverflow');
    if (validity.stepMismatch) return resolve('stepMismatch');
    if (validity.patternMismatch) return resolve('patternMismatch');
    if (validity.badInput) return resolve('badInput');
    // A message set by application code via setCustomValidity().
    if (validity.customError) return field.validationMessage;

    return resolve('default');
  }

  /** Every control in the form that can be validated. */
  function validatableFields(form) {
    return Array.prototype.slice
      .call(form.elements)
      .filter(function (element) {
        return (
          element.willValidate &&
          // A disabled or hidden control is not the user's problem.
          !element.disabled &&
          element.type !== 'submit' &&
          element.type !== 'button' &&
          element.type !== 'reset'
        );
      })
      .filter(function (element) {
        // Skip anything inside a collapsed conditional region: the user cannot
        // see it, so it must not block them.
        var hiddenAncestor = element.closest('[hidden]');
        return !hiddenAncestor;
      })
      .filter(function (element, _index, all) {
        /**
         * A radio group is ONE question with one answer, so it gets one error.
         *
         * Every radio in a required group reports the same `valueMissing`, and
         * treating them as separate fields produced one identical message per
         * option: "Enter how we should reply" printed beside every radio, and
         * repeated in the error summary once per option. Only the first radio of
         * each name survives here; the rest are the same field.
         */
        if (element.type !== 'radio') return true;
        return all.indexOf(all.filter(function (other) {
          return other.type === 'radio' && other.name === element.name;
        })[0]) === all.indexOf(element);
      });
  }

  /**
   * Where a field's error message belongs in the DOM.
   *
   * For a normal control that is directly after it. For a radio or checkbox inside
   * a group it is emphatically NOT: the input sits inside its own `<label>`, so
   * `afterend` puts the message between the radio and the word it labels —
   * "( ) [Enter how we should reply] By email". The message belongs after the whole
   * set of options, where the user reads it once, having seen all the choices.
   *
   * And where the control sits inside a wrapper that carries the border — a
   * password field and its reveal toggle, an input with a unit beside it, a
   * stepper — "directly after the input" is INSIDE that border, so the message
   * lands in the middle of the control, laid out as another flex item. The
   * message goes after the whole visual control instead.
   */

  /**
   * Wrappers that draw the field's box. The error belongs outside them.
   *
   * `.dds-password` is the one that made this necessary: it is generated around
   * every password field by components-forms.js, so a form can end up with a
   * wrapper nobody wrote and no obvious reason for the error message to be
   * sitting inside the input's border.
   */
  var FIELD_SHELLS =
    '.dds-password, .dds-input-group, .dds-confirm-wrap, .dds-select-wrap, ' +
    '.dds-stepper, .dds-search';

  function errorAnchorFor(field) {
    var group = field.closest('.dds-fieldgroup');

    if (group && (field.type === 'radio' || field.type === 'checkbox')) {
      // After the options, still inside the fieldset so it stays associated with
      // the legend.
      return {
        node: group.querySelector('.dds-fieldgroup-options') || group,
        position: 'beforeend',
      };
    }

    return { node: field.closest(FIELD_SHELLS) || field, position: 'afterend' };
  }

  /** Find (or create) the error element belonging to a field. */
  function errorElementFor(field) {
    var wrapper = field.closest('.dds-field, .dds-choice, .dds-fieldgroup') || field.parentElement;
    if (!wrapper) return null;

    var existing = wrapper.querySelector('[data-dds-error-for="' + field.id + '"]');
    if (existing) return existing;

    var element = document.createElement('p');
    element.className = 'dds-error';
    element.id = DDS.utils.uniqueId('dds-error');
    element.setAttribute('data-dds-error-for', field.id);
    element.hidden = true;

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'dds-icon');
    icon.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#dds-icon-error');
    icon.appendChild(use);
    element.appendChild(icon);

    // The word "Error" for anyone who does not perceive the colour or the icon.
    var prefix = document.createElement('span');
    prefix.className = 'dds-sr-only';
    prefix.textContent = DDS.utils.wording(field, WORDING).errorPrefix;
    element.appendChild(prefix);

    var text = document.createElement('span');
    text.setAttribute('data-dds-error-text', '');
    element.appendChild(text);

    // Reading order has to match visual order, which for a group means after the
    // options rather than after the one input that happened to be validated.
    var anchor = errorAnchorFor(field);
    if (anchor.position === 'beforeend') anchor.node.appendChild(element);
    else anchor.node.insertAdjacentElement(anchor.position, element);

    return element;
  }

  /** Add an id to a space-separated attribute without disturbing what is there. */
  function addDescribedBy(field, id) {
    var current = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (current.indexOf(id) === -1) current.push(id);
    field.setAttribute('aria-describedby', current.join(' '));
  }

  function removeDescribedBy(field, id) {
    var current = (field.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .filter(function (value) {
        return value !== id;
      });

    if (current.length) {
      field.setAttribute('aria-describedby', current.join(' '));
    } else {
      field.removeAttribute('aria-describedby');
    }
  }

  function showError(field, message) {
    if (!field.id) field.id = DDS.utils.uniqueId('dds-field');

    var element = errorElementFor(field);
    if (!element) return;

    element.querySelector('[data-dds-error-text]').textContent = message;
    element.hidden = false;

    field.setAttribute('aria-invalid', 'true');

    /* `aria-errormessage` for the error, `aria-describedby` for the hint.
       That is the specified pairing: `aria-errormessage` is only exposed while
       `aria-invalid="true"`, which is exactly the semantics wanted, and it keeps
       the hint's `aria-describedby` untouched so the format rule survives
       alongside the failure — the user needs both, not one replaced by the other.

       `aria-describedby` is additionally kept in sync, because screen-reader
       support for `aria-errormessage` is still uneven and a silently unannounced
       error is the worst possible outcome here. The duplication is deliberate:
       assistive technology that understands `aria-errormessage` uses it, and
       anything that does not still hears the message via the description. */
    field.setAttribute('aria-errormessage', element.id);
    addDescribedBy(field, element.id);
  }

  function clearError(field) {
    var element = field.closest('.dds-field, .dds-choice, .dds-fieldgroup, form')
      ? document.querySelector('[data-dds-error-for="' + field.id + '"]')
      : null;

    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-errormessage');

    if (element) {
      element.hidden = true;
      element.querySelector('[data-dds-error-text]').textContent = '';
      removeDescribedBy(field, element.id);
    }
  }

  /* =========================================================================
     Error summary
     ========================================================================= */

  function summaryElementFor(form) {
    var existing = form.querySelector('[data-dds-error-summary]');
    if (existing) return existing;

    var summary = document.createElement('div');
    summary.setAttribute('data-dds-error-summary', '');
    summary.className = 'dds-error-summary';
    // Focusable programmatically, but not a permanent tab stop.
    summary.tabIndex = -1;
    summary.hidden = true;
    form.prepend(summary);
    return summary;
  }

  function renderSummary(form, problems) {
    var summary = summaryElementFor(form);
    summary.replaceChildren();

    var heading = document.createElement('h2');
    heading.className = 'dds-error-summary-title';

    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'dds-icon');
    icon.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#dds-icon-error');
    icon.appendChild(use);
    heading.appendChild(icon);

    var headingText = document.createElement('span');
    headingText.textContent = DDS.utils.plural(
      form,
      problems.length,
      DDS.utils.wording(form, WORDING).summary
    );
    heading.appendChild(headingText);
    summary.appendChild(heading);

    var list = document.createElement('ul');
    list.className = 'dds-error-summary-list';

    problems.forEach(function (problem) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + problem.field.id;
      // The same wording as the field's own message, so the user is not asked to
      // reconcile two descriptions of one problem.
      link.textContent = problem.message;

      link.addEventListener('click', function (event) {
        // Manage focus explicitly: the default fragment jump scrolls the field
        // into view but does not always focus it, which leaves a keyboard user
        // looking at the field without being in it.
        event.preventDefault();
        problem.field.focus();
      });

      item.appendChild(link);
      list.appendChild(item);
    });

    summary.appendChild(list);
    summary.hidden = false;

    return summary;
  }

  function hideSummary(form) {
    var summary = form.querySelector('[data-dds-error-summary]');
    if (summary) {
      summary.hidden = true;
      summary.replaceChildren();
    }
  }

  /* =========================================================================
     Enhancement
     ========================================================================= */

  DDS.register('form-validation', 'form[data-dds-validate]', function (form) {
    // Take over the messaging. The constraints stay in the markup and are still
    // evaluated by the browser via checkValidity() — only the native bubble UI
    // is suppressed.
    form.setAttribute('novalidate', '');

    // Before the first submit attempt, nothing is shown. This flag is what makes
    // the form patient.
    var submitted = false;

    function validateField(field) {
      if (field.checkValidity()) {
        clearError(field);
        return null;
      }
      var message = messageFor(field);
      showError(field, message);
      return { field: field, message: message };
    }

    form.addEventListener('submit', function (event) {
      submitted = true;

      var problems = [];
      validatableFields(form).forEach(function (field) {
        if (!field.id) field.id = DDS.utils.uniqueId('dds-field');
        var problem = validateField(field);
        if (problem) problems.push(problem);
      });

      if (!problems.length) {
        hideSummary(form);
        return; // let the submit proceed
      }

      event.preventDefault();

      var summary = renderSummary(form, problems);

      // Move focus to the explanation. Without this the user is returned to
      // wherever they were, with no indication that anything happened.
      summary.focus();

      // Assertive: the user pressed submit and is waiting for the outcome, so
      // interrupting is correct here.
      DDS.announce(
        DDS.utils.plural(
          form,
          problems.length,
          DDS.utils.wording(form, WORDING).summaryAnnouncement
        ),
        { assertive: true, from: form }
      );
    });

    /* Bridge the visual state to the programmatic one.
     *
     * The CSS shows the invalid styling via `:user-invalid`, which matches only
     * once the browser's own "user has interacted" flag is set — on blur, or on a
     * submit attempt. There is no event for that flag changing, so the state is
     * read directly by testing the selector.
     *
     * Testing `:user-invalid` rather than tracking interaction here matters: the
     * programmatic state then changes at exactly the same moment as the visual
     * one, using the same definition of "the user has committed to this value".
     * Two separate notions of "touched" is how the ring and the announcement end
     * up disagreeing.
     *
     * `focusout` rather than `blur`, because blur does not bubble.
     */
    function supportsUserInvalid() {
      try {
        document.createElement('input').matches(':user-invalid');
        return true;
      } catch (error) {
        return false;
      }
    }

    var hasUserInvalid = supportsUserInvalid();

    function syncField(field) {
      if (!field.willValidate || field.disabled) return;

      // Below the `:user-invalid` floor, fall back to the submit-attempt flag —
      // the same timing, tracked by hand.
      var userInvalid = hasUserInvalid
        ? field.matches(':user-invalid')
        : submitted && !field.checkValidity();

      if (userInvalid) {
        showError(field, messageFor(field));
      } else if (field.getAttribute('aria-invalid') === 'true') {
        clearError(field);
      }
    }

    form.addEventListener(
      'focusout',
      function (event) {
        syncField(event.target);
      },
      true
    );

    // Clear the error the instant the correction becomes valid, so the user gets
    // immediate confirmation rather than having to submit again to find out.
    // `:user-invalid` stops matching at the same moment.
    form.addEventListener('input', function (event) {
      var field = event.target;
      if (!field.willValidate) return;
      if (field.getAttribute('aria-invalid') !== 'true') return;
      if (field.checkValidity()) clearError(field);
    });
  });

  /**
   * Exposed so application code can drive the same presentation for a
   * server-side or asynchronous error.
   *
   * `messageFor` is part of that surface for a reason worth stating: anything
   * that validates a field itself and then calls `showError` has to get the
   * message from somewhere, and the obvious somewhere — `field.validationMessage`
   * — is the wrong one twice over. It is the browser's wording, which is written
   * to be safe rather than useful ("Please match the requested format" tells the
   * user nothing), and it is in the browser's UI language rather than the page's.
   * The wizard did exactly that, so one form spoke with two voices depending on
   * which control the user pressed.
   */
  DDS.formValidation = {
    showError: showError,
    clearError: clearError,
    messageFor: messageFor,
    renderSummary: renderSummary,
    hideSummary: hideSummary,
    messages: MESSAGES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
