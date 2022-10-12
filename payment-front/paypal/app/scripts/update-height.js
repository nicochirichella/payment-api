/**
 * Created by javieranselmi on 8/30/17.
 */
function getHeight() {
    var body = document.body,
        html = document.documentElement;

    return 5 + Math.max(
            body.offsetHeight,
            html.offsetHeight
        );
}
