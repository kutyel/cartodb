var _ = require('underscore');
var Backbone = require('backbone');
var InputRampListView = require('../../../../../../../../../javascripts/cartodb3/components/form-components/editors/fill/input-color/input-ramps/input-ramp-list-view');
var rampList = require('../../../../../../../../../javascripts/cartodb3/components/form-components/editors/fill/input-color/input-ramps/ramps');

describe('components/form-components/editors/fill/input-color/input-ramps/input-ramp-list-view', function () {
  describe('with a default ramp', function () {
    beforeEach(function () {
      this.model = new Backbone.Model({
        bins: 7,
        range: ['#F1EEF6', '#D4B9DA', '#C994C7', '#DF65B0', '#E7298A', '#CE1256', '#91003F'],
        attribute: 'column1',
        quantification: 'jenks'
      });

      this.view = new InputRampListView(({
        model: this.model
      }));

      this.view.render();
    });

    it('should render properly', function () {
      expect(this.view.$('.js-listItem').length).toBe(_.toArray(rampList).length);
      expect(this.view.$('.js-customList').text()).toContain('form-components.editors.fill.customize');
      expect(this.view.$('.is-selected').parent().data('val')).toContain('#F1EEF6,#D4B9DA,#C994C7,#DF65B0,#E7298A,#CE1256,#91003F');
    });

    it('should select ramp on click', function () {
      this.view.$('.js-listItem:eq(2)').click();
      var ramp = rampList.pink[7];
      expect(this.model.get('range').join(',')).toBe(ramp.join(','));
      expect(this.view.$('.is-selected').parent().data('val')).toContain(ramp);
      expect(this.view.$('.is-selected').length).toBe(1);
    });

    it('should trigger a switch event', function () {
      var switchEvent;

      this.view.bind('switch', function () {
        switchEvent = true;
      });

      this.view.$('.js-switch').click();
      expect(switchEvent).toBeTruthy();
    });

    afterEach(function () {
      this.view.remove();
    });
  });

  describe('with a custom ramp', function () {
    beforeEach(function () {
      this.model = new Backbone.Model({
        bins: 3,
        range: ['#FABADA', '#FADFAD', '#BADBAD'],
        attribute: 'column1',
        quantification: 'jenks'
      });

      this.view = new InputRampListView(({
        model: this.model
      }));

      this.view.render();
    });

    it('should render properly', function () {
      expect(this.view.$('.js-customRamp').hasClass('is-selected')).toBeTruthy();
      expect(this.view.$('.js-customRamp .ColorBar:eq(0)').css('background-color')).toBe('rgb(250, 186, 218)');
      expect(this.view.$('.js-customRamp .ColorBar:eq(1)').css('background-color')).toBe('rgb(250, 223, 173)');
      expect(this.view.$('.js-customRamp .ColorBar:eq(2)').css('background-color')).toBe('rgb(186, 219, 173)');
    });

    it('should select the custom ramp', function () {
      this.view.$('.js-listItemLink:eq(0)').click();
      this.view.$('.js-customRamp').click();
      expect(this.view.$('.js-customRamp').hasClass('is-selected')).toBeTruthy();
    });

    it('should clear the custom ramp', function () {
      expect(this.view.$('.js-customRamp .ColorBar').length).toBe(3);
      this.view.$('.js-clear').click();
      expect(this.view.$('.js-customRamp .ColorBar').length).toBe(0);
    });

    afterEach(function () {
      this.view.remove();
    });
  });
});