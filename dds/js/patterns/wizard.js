/**
 * DDS — wizard pattern.
 *
 *   <script src="/dds/js/dds.js" defer></script>
 *   <script src="/dds/js/patterns/wizard.js" defer></script>
 *
 * A process split into ordered steps, one visible at a time.
 *
 * -----------------------------------------------------------------------------
 * This is an enhancement, not the architecture
 * -----------------------------------------------------------------------------
 *
 * The reference model for a multi-step process is one URL per step, rendered by
 * the server, each step a real form that posts. That survives a reload, a shared
 * link, the back button, a dropped connection and a failed script — and it
 * cannot lose the user's answers, because they are already on the server.
 *
 * This module makes a single-page version behave correctly. Use it when the
 * steps are short and the whole thing submits once. Do NOT use it to replace a
 * server-side flow for anything long or valuable: a browser crash on step six
 * of a client-side wizard loses everything.
 *
 * Without this file, every step is visible and the form is one long page that
 * submits. Longer to fill in, and it works.
 *
 * -----------------------------------------------------------------------------
 * The rules it enforces
 * -----------------------------------------------------------------------------
 *
 *  - Back never discards input. Steps are hidden, never emptied or replaced.
 *    Break this and the user learns not to go back, and stops checking answers.
 *  - Hidden steps do not block submission: their fields are `disabled` while
 *    hidden, so `required` cannot fail on a field nobody can see. Disabled
 *    fields are also excluded from submission, which is why they are re-enabled
 *    before the final submit.
 *  - Focus moves to the new step's heading, and the change is announced. Without
 *    it, focus sits on a button that is now hidden and a screen-reader user has
 *    no idea anything happened.
 *  - Position is stated as text — "Step 2 of 4".
 *  - Advancing validates the current step only. Validating the whole form would
 *    report problems the user has not reached yet.
 */
(function (global) {
  'use strict';

  var DDS = global.DDS;
  if (!DDS) {
    console.error('[DDS] wizard.js requires dds.js to be loaded first');
    return;
  }

  /**
   * Wizard wording.
   *
   * `position` and `change` are the same two numbers said twice — once as the
   * visible line above the step, once as the announcement, which also carries
   * the step's own heading. They are separate entries because they are separate
   * sentences: the visible one is a label and the spoken one is what a
   * screen-reader user gets instead of seeing the step change.
   *
   * `fallbackLabel` is only reached when a step has no heading, which is a
   * markup defect. The announcement should still be a sentence.
   */
  var WORDING = {
    en: {
      position: function (current, total) {
        return 'Step ' + current + ' of ' + total;
      },
      change: function (current, total, label) {
        return 'Step ' + current + ' of ' + total + ': ' + label;
      },
      fallbackLabel: function (index) {
        return 'Step ' + index;
      },
      problems: {
        one: 'There is 1 problem on this step.',
        other: 'There are {n} problems on this step.',
      },
      /* The indicator's status in words, so it does not depend on the marker's
         colour (WCAG 1.4.1). These were the three literals nobody notices,
         because they are visually hidden and only ever spoken. */
      done: 'Completed',
      currentStep: 'Current step',
      todo: 'Not started',
    },
    de: {
      position: function (current, total) {
        return 'Schritt ' + current + ' von ' + total;
      },
      change: function (current, total, label) {
        return 'Schritt ' + current + ' von ' + total + ': ' + label;
      },
      fallbackLabel: function (index) {
        return 'Schritt ' + index;
      },
      problems: {
        one: 'Es gibt 1 Problem in diesem Schritt.',
        other: 'Es gibt {n} Probleme in diesem Schritt.',
      },
      done: 'Abgeschlossen',
      currentStep: 'Aktueller Schritt',
      todo: 'Noch nicht begonnen',
    },
  };

  DDS.register('wizard', '[data-dds-wizard]', function (root) {
    var words = DDS.utils.wording(root, WORDING);

    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-dds-wizard-step]'));
    if (steps.length < 2) return;

    var form = root.closest('form') || root.querySelector('form');
    var indicator = root.querySelector('[data-dds-wizard-steps]');
    var current = 0;

    /* --- keep hidden fields out of validation and submission ------------- */

    /**
     * Disable the fields of a hidden step.
     *
     * Two reasons, and both are the kind of bug that only shows up late:
     *   1. `required` on a field the user cannot see blocks submission with no
     *      visible explanation — the browser cannot even focus it to complain.
     *   2. A disabled field is not submitted, so a step the user skipped does
     *      not send empty values that overwrite real ones.
     *
     * The original `disabled` state is remembered, so a field that was already
     * disabled by the product stays that way.
     */
    function setStepEnabled(step, enabled) {
      step.querySelectorAll('input, select, textarea, button').forEach(function (field) {
        if (enabled) {
          if (field.dataset.ddsWizardWasDisabled === 'true') return;
          field.disabled = false;
        } else {
          field.dataset.ddsWizardWasDisabled = field.disabled ? 'true' : 'false';
          field.disabled = true;
        }
      });
    }

    function label(step, index) {
      var heading = step.querySelector('[data-dds-wizard-heading]');
      return heading ? heading.textContent.trim() : words.fallbackLabel(index + 1);
    }

    function paintIndicator() {
      if (!indicator) return;

      var items = Array.prototype.slice.call(indicator.querySelectorAll('[data-dds-step]'));
      items.forEach(function (item, index) {
        if (index < current) {
          item.setAttribute('data-dds-step', 'done');
          item.removeAttribute('aria-current');
        } else if (index === current) {
          item.setAttribute('data-dds-step', 'current');
          // "step", not "page": the user has not navigated anywhere.
          item.setAttribute('aria-current', 'step');
        } else {
          item.setAttribute('data-dds-step', 'todo');
          item.removeAttribute('aria-current');
        }

        // The status in words, so it does not depend on the marker's colour.
        var status = item.querySelector('[data-dds-step-status]');
        if (status) {
          status.textContent =
            index < current ? words.done : index === current ? words.currentStep : words.todo;
        }
      });
    }

    function show(index, announce) {
      current = Math.max(0, Math.min(index, steps.length - 1));

      steps.forEach(function (step, i) {
        var active = i === current;
        step.hidden = !active;
        setStepEnabled(step, active);
      });

      paintIndicator();

      var position = root.querySelector('[data-dds-wizard-position]');
      if (position) {
        position.textContent = words.position(current + 1, steps.length);
      }

      if (!announce) return;

      var heading = steps[current].querySelector('[data-dds-wizard-heading]');
      if (heading) {
        // `tabindex="-1"` is set here rather than demanded of the markup: it is
        // only needed because this script moves focus, so it should not be
        // present when the script is not.
        heading.tabIndex = -1;
        heading.focus();
      }

      DDS.announce(words.change(current + 1, steps.length, label(steps[current], current)), {
        from: root,
      });
    }

    /* --- validation, current step only ---------------------------------- */

    function validateCurrent() {
      var fields = Array.prototype.slice
        .call(steps[current].querySelectorAll('input, select, textarea'))
        .filter(function (field) {
          return field.willValidate && !field.disabled;
        });

      var invalid = fields.filter(function (field) {
        return !field.checkValidity();
      });

      if (!invalid.length) return true;

      // Reuse the shared validation presentation when it is loaded, so the
      // wording and markup match the rest of the form. Fall back to the native
      // report rather than silently refusing to advance.
      if (DDS.formValidation) {
        invalid.forEach(function (field) {
          if (!field.id) field.id = DDS.utils.uniqueId('dds-field');
          /**
           * `messageFor`, not `field.validationMessage`.
           *
           * The native message is the browser's own wording in the browser's own
           * UI language, so the same empty required field said one thing on a
           * step and something else on the form around it — and said it in
           * English on a German page, or the reverse, depending on the machine.
           *
           * It is also not guaranteed to be a sentence at all. An empty
           * `validationMessage` puts an empty error element on the page:
           * `aria-invalid` is set, `aria-errormessage` points at it, and there is
           * nothing to announce. Visibly there is a red line with no text in it,
           * which is the shape of the WebKit-only failure in #9.
           */
          DDS.formValidation.showError(field, DDS.formValidation.messageFor(field));
        });
        invalid[0].focus();
        DDS.announce(DDS.utils.plural(root, invalid.length, words.problems), {
          assertive: true,
          from: root,
        });
      } else {
        invalid[0].reportValidity();
      }

      return false;
    }

    /* --- wiring --------------------------------------------------------- */

    root.querySelectorAll('[data-dds-wizard-next]').forEach(function (button) {
      // `type="button"`, or the browser submits the form instead of advancing.
      if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.type = 'button';

      button.addEventListener('click', function () {
        if (!validateCurrent()) return;
        show(current + 1, true);
      });
    });

    root.querySelectorAll('[data-dds-wizard-back]').forEach(function (button) {
      if (button.tagName === 'BUTTON' && !button.getAttribute('type')) button.type = 'button';

      button.addEventListener('click', function () {
        // Deliberately no validation going back: a user must always be able to
        // leave a step they have not finished.
        show(current - 1, true);
      });
    });

    // Jumping straight to a step, from a review screen's "Change" link.
    root.querySelectorAll('[data-dds-wizard-goto]').forEach(function (control) {
      control.addEventListener('click', function (event) {
        event.preventDefault();
        var target = Number(control.getAttribute('data-dds-wizard-goto'));
        if (Number.isFinite(target)) show(target, true);
      });
    });

    if (form) {
      // Re-enable every step's fields before submitting, or the answers from
      // steps that are currently hidden are dropped.
      form.addEventListener('submit', function () {
        steps.forEach(function (step) {
          setStepEnabled(step, true);
        });
      });
    }

    // Initial paint: no announcement and no focus move, because nothing has
    // happened yet from the user's point of view.
    show(0, false);
  });
})(typeof window !== 'undefined' ? window : globalThis);
