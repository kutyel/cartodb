var Backbone = require('backbone');
var QueryRowModel = require('./query-row-model');
var syncAbort = require('./backbone/sync-abort');
var _ = require('underscore');

var MAX_GET_LENGTH = 1024;
var WRAP_SQL_TEMPLATE = 'select <%= selectedColumns %> from (<%= sql %>) __wrapped';

var STATUS = {
  unavailable: 'unavailable',
  unfetched: 'unfetched',
  fetching: 'fetching',
  fetched: 'fetched'
};

module.exports = Backbone.Collection.extend({

  DEFAULT_FETCH_OPTIONS: {
    rows_per_page: 40,
    sort_order: 'asc',
    page: 0
  },

  // Due to a problem how Backbone checks if there is a duplicated model
  // or not, we can't create the model with a function + its necessary options
  model: QueryRowModel,

  sync: syncAbort,

  url: function () {
    return this._configModel.getSqlApiUrl();
  },

  initialize: function (models, opts) {
    opts = opts || {};

    this._tableName = opts.tableName;
    this._querySchemaModel = opts.querySchemaModel;
    this._configModel = opts.configModel;

    this.statusModel = new Backbone.Model({
      status: STATUS.unavailable
    });

    this._initBinds();
  },

  _initBinds: function () {
    this.listenTo(this._querySchemaModel, 'change:query', this._onQuerySchemaQueryChange);
  },

  isFetched: function () {
    return this.statusModel.get('status') === STATUS.fetched;
  },

  isFetching: function () {
    return this.statusModel.get('status') === STATUS.fetching;
  },

  shouldFetch: function () {
    return !this.isFetched() && !this.isFetching() && this.canFetch();
  },

  resetFetch: function () {
    this.statusModel.set('status', STATUS.unfetched);
  },

  isEmpty: function () {
    return this.size() === 0;
  },

  canFetch: function () {
    return !!this._querySchemaModel.get('query') && this._querySchemaModel.get('ready') && this._querySchemaModel.isFetched();
  },

  _onQuerySchemaQueryChange: function () {
    this.statusModel.set('status', 'unfetched');
    this.reset([], { silent: true });
  },

  _geometryColumnSQL: function (column) {
    /* eslint-disable */
    return [
      "CASE",
      "WHEN GeometryType(" + column + ") = 'POINT' THEN",
        "ST_AsGeoJSON(" + column + ",8)",
      "WHEN (" + column + " IS NULL) THEN",
        "NULL",
      "ELSE",
        "GeometryType(" + column + ")",
      "END " + column
    ].join(' ');
    /* eslint-enable */
  },

  // return wrapped SQL removing the_geom and the_geom_webmercator
  // to avoid fetching those columns.
  // So for a sql like
  // select * from table the returned value is
  // select column1, column2, column3... from table
  _getWrappedSQL: function (excludeColumns) {
    var self = this;
    var schema = this._querySchemaModel.columnsCollection.toJSON();

    var selectedColumns = _
      .chain(schema)
      .omit(function (item) {
        return _.contains(excludeColumns, item.name);
      })
      .map(function (item, index) {
        if (item.type === 'geometry') {
          return self._geometryColumnSQL(item.name);
        }
        return '"' + item.name + '"';
      })
      .value();

    return _.template(WRAP_SQL_TEMPLATE)({
      selectedColumns: selectedColumns.join(','),
      sql: this._querySchemaModel.get('query')
    });
  },

  _httpMethod: function () {
    return this._querySchemaModel.get('query').length > MAX_GET_LENGTH
      ? 'POST'
      : 'GET';
  },

  fetch: function (opts) {
    opts = opts || {};

    this.statusModel.set('status', STATUS.fetching);

    var excludeColumns = (opts.data && opts.data.exclude) || [];

    opts = opts || {};
    opts.data = _.extend(
      {},
      this.DEFAULT_FETCH_OPTIONS,
      opts.data && _.omit(opts.data, 'exclude') || {},
      {
        api_key: this._configModel.get('api_key'),
        q: this._getWrappedSQL(excludeColumns)
      }
    );

    opts.method = this._httpMethod();
    var errorCallback = opts.error;
    opts.error = function (coll, resp) {
      this.trigger('fail', coll, resp);
      this.statusModel.set('status', STATUS.unavailable);
      errorCallback && errorCallback(coll, resp);
    }.bind(this);

    var successCallback = opts.success;
    opts.success = function (coll, resp) {
      this.statusModel.set('status', STATUS.fetched);
      successCallback && successCallback(coll, resp);
    }.bind(this);

    // Needed to reset the whole collection when a fetch is done
    opts.reset = true;

    return Backbone.Collection.prototype.fetch.call(this, opts);
  },

  parse: function (r) {
    return this._parseWithID(r.rows);
  },

  reset: function (result, opts) {
    var items = [];

    if (result && result.rows) {
      // If reset comes from a fetch, we need to parse the rows
      items = result.rows;
    } else {
      // If it comes directly from a simple reset function
      items = result;
    }

    Backbone.Collection.prototype.reset.apply(this, [this._parseWithID(items)]);
  },

  _parseWithID: function (array) {
    return _.map(array, function (attrs) {
      attrs.__id = _.uniqueId();
      return attrs;
    });
  },

  addRow: function (opts) {
    opts = opts || {};
    this.create(
      {
        __id: _.uniqueId()
      },
      _.extend(
        opts,
        {
          wait: true,
          parse: true
        }
      )
    );
  },

  setTableName: function (name) {
    if (!name) return;

    if (this._tableName) {
      this._tableName = name;

      this.each(function (rowModel) {
        rowModel._tableName = name;
      });
    }
  }
});
