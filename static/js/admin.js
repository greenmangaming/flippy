(function($, Conditions) {
  var DEFAULT_CONDITION = {condition_type: 'false'};
  var SPINNER_ICON = '../img/spinner.svg';

  var $errorBox;

  // Controls for building a switch
  var SwitchBuilder = function(initial, admin) {
    var self = this;

    initial = initial || {};
    self.name = initial.name || 'New switch';
    self.condition = initial.condition || {switch_type: 'false'};
    self.initialCondition = self.condition;
    self.admin = admin;
    self.deleted = false;

    self.baseUrl = self.admin.baseUrl;
    self.displayError = self.admin.displayError;
    self.displaySuccess = self.admin.displaySuccess;

    self.isUnsaved = function() {
      if (self.deleted) {
        return false;
      }

      if (!self.widget) {
        return false;
      }

      if (!self.widget.clean()) {
        return true;
      }

      return (
        JSON.stringify(self.widget.buildJSON()) !==
        JSON.stringify(self.condition)
      );
    };

    self.save = function() {
      var $save = self.$controls.find('[data-action="save"]');
      $save.attr('disabled', true);

      // Update the JSON in the textarea from the GUI components
      if (!self.widget.clean()) {
        self.displayError(
          self.widget.error || 'Unspecified validation failure',
          'Form validation error'
        );
        $save.attr('disabled', false);
        return;
      }
      var condition = self.widget.buildJSON();

      var success = function() {
        $save.attr('disabled', false);
        self.condition = condition;
        self.reset();

        self.displaySuccess(
          'Switch <span class="switch-name">' + self.name + '</span> successfully updated.',
          'Switch saved'
        );
      };
      var err = function() {
        $save.attr('disabled', false);
      };
      self.updateSwitch(condition, success, err);
    };

    self.render = function() {
      var $controls = $('<div>').addClass('switch').attr('data-name', self.name);
      $controls.append($('<span>').addClass('name').text(self.name));
      $controls.append(self.renderGui(self.condition));

      var $persistControls = $('<div>').addClass('persist');
      var $saveButton = $('<button>')
        .text('Save')
        .addClass('save')
        .attr('data-action', 'save')
        .click(self.save);

      var $cancelButton = $('<button>').text('Cancel').addClass('cancel');
      $cancelButton.click(function() {
        self.reset();
      });

      var $deleteButton = $('<button>').text('Delete').addClass('delete');
      $deleteButton.click(function() {
        if(!confirm('Are you sure you want to delete the ' + self.name + ' switch?')) {
          return;
        }

        self.deleteSwitch();
      });

      $persistControls.append($saveButton).append($cancelButton).append($deleteButton);
      $controls.append($persistControls);

      self.$controls = $controls;
      return self.$controls;
    };

    self.reset = function() {
      self.$controls.find('.switch-builder').replaceWith(self.renderGui(self.condition));
    };

    self.renderGui = function(initial) {
      var $builder = $('<div>').addClass('switch-builder');
      var $select = Conditions.baseConditions.asOptions().addClass(
        'main-condition-selector'
      );
      var $stage = $('<div>').addClass('stage');

      var renderWidget = function(type, data) {
        if (!type) {
          return;
        }

        var previousWidget = self.widget;
        self.widget = new Conditions.createCondition(type, data ? null : self.widget);

        var $condForm = data ? self.widget.init(data) : self.widget.renderForm();
        $stage.html($condForm);
      };

      $select.on('change', function() {
        renderWidget($(this).val());
      });

      renderWidget(
        Conditions.conditionTypes[initial.condition_type] || initial.condition_type,
        initial
      );
      $builder.html($select).append($stage);
      return $builder;
    };

    self.updateSwitch = function(condition, success, err) {
      success = success || function() {};
      err = err || function() {};

      $.ajax({
        url: self.baseUrl + 'switch/' + self.name + '/',
        type: 'POST',
        data: JSON.stringify(condition),
        dataType: 'json',
        contentType: 'application/json',
        success: success,
        error: function(resp) {
          self.displayError(resp.responseText, resp.status + ' ' + resp.statusText);
          err();
        }
      });
    };

    self.deleteSwitch = function() {
      $.ajax({
        url: self.baseUrl + 'switch/' + self.name + '/',
        type: 'DELETE',
        success: function() {
          self.deleted = true;
          self.admin.switchDeleted(self.name);
        },
        error: function(resp) {
          self.displayError(resp.responseText, resp.status + ' ' + resp.statusText);
        }
      });
    };

  };

  var Admin = function(cfg) {
    var self = this;
    self.protocol = cfg.protocol;
    self.host = cfg.host;
    self.port = cfg.port;
    self.pathPrefix = cfg.path_prefix || '/';
    self.noConflict = !!cfg.no_conflict;
    self.switches = [];

    self.$container = cfg.container;

    if (!self.protocol && !self.host && !self.port) {
      self.baseUrl = self.pathPrefix;
    } else {
      self.baseUrl = (
        (self.protocol || 'http') + '://' +
        (self.host || 'localhost') + ':' + (self.port || 80) + '/' +
        self.pathPrefix
      );
    }

    self.$msgBox = cfg.message_box || $('#flippy-admin-message');
    self.$msgBox.addClass('flippy-admin-message');
    self.$msgBox.click(function() {
      $(this).hide();
    });

    // If no_conflict is set we'll assume doing anything global will
    // clash with something, so don't bind to window unload
    if (!self.noConflict) {
      window.onbeforeunload = function() {
        var unsaved = self.getUnsavedSwitches();
        if (unsaved.length === 0) {
          return null;
        }

        return (
          'Are you sure you want to leave? These switches have not been saved: ' +
          unsaved.join(', ')
        );
      };
    }

    self.getUnsavedSwitches = function() {
      return self.switches.filter(function(e) {
        return e.isUnsaved();
      });
    };

    self.listSwitches = function(offset, cb) {
      offset = offset || 0;

      // Show spinner after 1s
      var timer = setTimeout(function() {
        self.$spinner.show();
      }, 1000);

      $.ajax({
        url: self.baseUrl + 'switch/?offset=' + offset,
        type: 'GET',
        success: function(data) {
          self.renderSwitches(data);
        },
        error: function(xhr, textStatus, errorThrown) {
          if (errorThrown) {
            self.displayError('', xhr.status + ' ' + errorThrown);
          } else {
            self.displayError(textStatus, 'Unexpected error');
          }
        },
        complete: function() {
          clearTimeout(timer);
          self.$spinner.hide();
          (cb || function() {})();
        }
      });
    };

    self.renderSwitches = function(switches) {
      for (var i = 0; i < switches.length; i++) {
        var s = new SwitchBuilder(switches[i], self);
        self.switches.push(s);
        self.$switchList.append(s.render());
      }
    };

    // Render the controls for new switches etc.
    self.renderControls = function() {
      // HEADER CONTROLS
      var $newSwitch = $('<button>').addClass('new-switch').addClass('themed-button').text(
        'Create switch'
      );
      var $newSwitchControls = $('<span>').addClass('new-switch-controls').addClass('extended');
      var $nameBox = $('<input>').addClass('name').val('new_switch');
      var $confirmButton = $('<button>').addClass('confirm').text('Create');
      $newSwitchControls.html($nameBox).append($confirmButton);

      $newSwitch.click(function() {
        $newSwitchControls.show();
        $newSwitch.hide();
      });

      $confirmButton.click(function() {
        var name = $nameBox.val();
        $nameBox.val('new_switch');

        if (self.$container.find('.switch[data-name="' + name + '"]').length !== 0) {
          self.displayError('A switch with that name already exists.', 'Bad switch name');
          return;
        }

        var newSwitch = new SwitchBuilder(
          {name: name, condition: DEFAULT_CONDITION}, self
        );
        self.switches.push(newSwitch);
        self.$switchList.prepend(newSwitch.render());
        $newSwitchControls.hide();
        $newSwitch.show();
      });
      self.$headerControls.html($newSwitch);
      self.$headerControls.append($newSwitchControls);

      // FOOTER CONTROLS
      $showMore = $('<button>').addClass('show-more').text('Show more...');
      $showMore.click(function() {
        $showMore.attr('disabled', true);
        var offset = self.$container.find('.switch').length;

        self.listSwitches(offset, function() {
          $showMore.attr('disabled', false);
        });
      });
      self.$footerControls.html($showMore);

    };

    self.displayMessage = function(msg, title, type) {
      self.$msgBox.hide();
      self.$msgBox.empty();

      if (title) {
        self.$msgBox.html($('<h1>').text(title));
      }
      self.$msgBox.append($('<span>').html(msg));

      self.$msgBox[type === 'error' ? 'addClass' : 'removeClass']('error');
      self.$msgBox.show();
    };
    self.displaySuccess = self.displayInfo = function(msg, title) {
      self.displayMessage(msg, title, 'info');
    };
    self.displayError = function(msg, title) {
      self.displayMessage(msg, title, 'error');
    };

    self.render = function() {
      self.$container.empty();
      self.$headerControls = $('<div>').addClass('controls');
      self.$switchList = $('<div>').addClass('switches');
      self.$spinner = $('<img>').attr('src', SPINNER_ICON).addClass('spinner');
      self.$footerControls = $('<div>').addClass('controls');

      self.$container.append(self.$headerControls);
      self.$container.append(self.$switchList);
      self.$container.append(self.$spinner);
      self.$container.append(self.$footerControls);

      self.renderControls();
      self.listSwitches();
    };

    // Called to indicate a switch has been removed
    self.switchDeleted = function(name) {
      self.$container.find('.switch[data-name="' + name + '"]').remove();
    };
  };

  window.FlippyAdmin = Admin;
})(jQuery, Conditions);
