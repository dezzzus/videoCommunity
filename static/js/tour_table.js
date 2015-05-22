var TourRow = Backbone.View.extend({
    rowTemplate: _.template(
        '<div class="row tour_table_row">' +
            '<div class="col-md-2">' +
                '<% if (hasThumb) { %>' +
                    '<a href="/video/<%= _id %>">' +
                    '<img class="tour_thumb" alt="Thumbnail"' +
                        'src="http://cdn.virtualvizzit.com/<%= videoID %>-thumb-00001.png">' +
                    '</a>' +
                '<% } %>' +
            '</div>' +
            '<div class="col-md-3">' +
                '<div class="tour_address">' +
                    '<a href="/video/<%= _id %>"><%= address %></a>' +
                '</div>' +
                '<div class="tour_info">' +
                    '<% if(beds) { %>' +
                        '<%= beds %> bd ' +
                    '<% } %>' +
                    '<% if(beds && baths) { %>' +
                        '&bull; ' +
                    '<% } %>' +
                    '<% if(baths) { %>' +
                        '<%= baths %> ba ' +
                    '<% } %>' +
                    '<% if(price) { %>' +
                        '<%= price %>$' +
                    '<% } %>' +
                '</div>' +
            '</div>' +
            '<div class="col-md-2">' +
                '<% if (landlord) { %>' +
                    '<div class="tour_landlord">' +
                        'Landlord: <%= landlord %>' +
                    '</div>' +
                '<% } %>' +
            '</div>' +
            '<div class="col-md-2">' +
                '<div class="tour_date">' +
                    '<% if (creationDate) { %>' +
                        '<%= creationDate.toDateString() %>' +
                    '<% } %>' +
                '</div>' +
            '</div>' +
            '<div class="col-md-1">' +
                '<div class="tour_action">' +
                    '<a class="btn btn-primary" href="/tour/<%= _id %>/edit">edit</a>' +
                '</div>' +
            '</div>' +
            '<div class="col-md-2">' +
                '<div class="tour_action">' +
                    '<a class="btn btn-danger"' +
                        'onclick=\'vvzzt.ui.followURLAfterConfirm("Are you sure you want to delete " + "<%= address %>" + "?",' +
                    '"/tour/<%= _id %>/del")\'>delete</a>' +
                '</div>' +
            '</div>' +
        '</div>'
    ),
    render: function () {
        if (!this.model.get('hasThumb')) {
            this.model.set('hasThumb', false);
        }
        if (!this.model.get('beds')) {
            this.model.set('beds', false);
        }
        if (!this.model.get('baths')) {
            this.model.set('baths', false);
        }
        if (!this.model.get('price')) {
            this.model.set('price', false);
        }
        if (!this.model.get('landlord')) {
            this.model.set('landlord', false);
        }
        if (!this.model.get('creationDate')) {
            this.model.set('creationDate', false);
        }
        else {
            this.model.set('creationDate', new Date(this.model.get('creationDate')))
        }

        this.$el.html(this.rowTemplate(this.model.attributes));
    }
});

var TourTable = Backbone.View.extend({
    render: function () {
        var self = this;
        self.$el.empty();

        this.collection.each(
            function (model) {
                var currentRow = new TourRow({
                    model: model
                });
                currentRow.render();
                self.$el.append(currentRow.$el);
            }
        );

    }

});