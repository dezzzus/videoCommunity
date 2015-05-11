var AptTour = Backbone.Model.extend();
var dummyAptTour = new AptTour({
    '_id': 'asdf',
    'videoID': 'asdf',
    'address': 'asdf'
});

var TourRow = Backbone.View.extend({
    rowTemplate: _.template('<div class="row tour_table_row">' +
        '<%= address %>' +
        '</div>'),
    render: function () {
        this.$el.html(this.rowTemplate(this.model.attributes));
    }
});

var TourTable = Backbone.View.extend({
    render: function () {
        for (var i = 0; i < 5; i++) {
            var currentRow = new TourRow({
                model: dummyAptTour
            });
            currentRow.render();
            this.$el.append(currentRow.$el);
        }
    }
});